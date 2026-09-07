package api

import (
	"context"
	"encoding/xml"
	"errors"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"log"
	"lumina/src/domain/comment"
	"lumina/src/domain/model"
	"lumina/src/domain/post"
	"lumina/src/domain/recommendation"
	"lumina/src/domain/repository"
	seriesdomain "lumina/src/domain/series"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
	store "lumina/src/infrastructure/storage"
	"mime/multipart"
	"net/http"
	"net/smtp"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	App             *fiber.App
	auth            user.Service
	posts           post.Service
	comments        comment.Service
	taxonomy        taxonomy.Service
	storage         store.Storage
	bookmarks       repository.BookmarkRepository
	follows         repository.FollowRepository
	series          seriesdomain.Service
	recommendations *recommendation.Service
	db              *mongo.Database
	cfg             config.Config
}

func New(cfg config.Config, a user.Service, p post.Service, c comment.Service, t taxonomy.Service, series seriesdomain.Service, recommendations *recommendation.Service, st store.Storage, follows repository.FollowRepository, bookmarks repository.BookmarkRepository, databases ...*mongo.Database) *Server {
	if cfg.CommentRateLimit < 1 {
		cfg.CommentRateLimit = 6
	}
	s := &Server{auth: a, posts: p, comments: c, taxonomy: t, series: series, recommendations: recommendations, storage: st, follows: follows, cfg: cfg}
	s.bookmarks = bookmarks
	if len(databases) > 0 {
		s.db = databases[0]
	}
	s.App = fiber.New(fiber.Config{
		ErrorHandler:   s.errors,
		BodyLimit:      8 * 1024 * 1024,
		ReadBufferSize: 32 * 1024,
	})
	s.routes()
	return s
}
func (s *Server) routes() {
	a := s.App
	a.Use(recover.New())
	a.Use(cors.New(cors.Config{AllowOrigins: s.cfg.ClientOrigin, AllowCredentials: true, AllowHeaders: "Origin, Content-Type, Accept, Authorization"}))
	a.Use(cacheHeaders)
	a.Use(etag.New(etag.Config{Next: func(c *fiber.Ctx) bool {
		return c.Method() != fiber.MethodGet || !etagPublicAPI(c.Path())
	}}))
	a.Static("/uploads", s.cfg.StoragePath)
	a.Get("/robots.txt", func(c *fiber.Ctx) error {
		c.Type("text/plain")
		return c.SendString("User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /profile/\nDisallow: /saved\nDisallow: /todos\nDisallow: /stories/\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /offline\nDisallow: /search\nSitemap: " + strings.TrimSuffix(s.cfg.ClientOrigin, "/") + "/sitemap.xml\n")
	})
	a.Get("/sitemap.xml", s.sitemap)
	api := a.Group("/api")
	auth := api.Group("/auth", limiter.New(limiter.Config{Max: 20, Expiration: time.Minute}))
	auth.Post("/register", s.register)
	auth.Post("/login", s.login)
	auth.Post("/refresh", s.refresh)
	auth.Post("/logout", s.logout)
	auth.Post("/forgot-password", s.forgotPassword)
	auth.Post("/reset-password", s.resetPassword)
	auth.Get("/me", s.requireAuth, s.me)
	api.Get("/posts", s.listPosts)
	api.Get("/posts/:slug", s.getPost)
	api.Get("/posts/:slug/comments", s.listComments)
	api.Get("/categories", s.listCategories)
	api.Get("/categories/:slug", s.getCategory)
	api.Get("/tags", s.listTags)
	api.Get("/tags/:slug", s.getTag)
	api.Get("/series", s.listSeries)
	api.Get("/series/:slug", s.getSeries)
	api.Get("/posts/:slug/series", s.postSeries)
	api.Get("/authors/:username", s.publicAuthor)
	api.Get("/authors/:username/follow", s.authorFollowStatus)
	api.Get("/recommendations", s.contextRecommendations)
	api.Get("/discussions", s.listDiscussions)
	api.Get("/discussions/:id", s.getDiscussion)
	api.Post("/discussions", s.requireAuth, s.createDiscussion)
	api.Post("/discussions/:id/comments", s.requireAuth, s.commentDiscussion)
	api.Put("/discussions/:id/interested", s.requireAuth, s.toggleDiscussionInterest)
	commentLimiter := limiter.New(limiter.Config{Max: s.cfg.CommentRateLimit, Expiration: time.Minute, KeyGenerator: func(c *fiber.Ctx) string {
		if id, ok := c.Locals("user_id").(primitive.ObjectID); ok {
			return id.Hex()
		}
		return c.IP()
	}})
	api.Post("/posts/:slug/comments", s.requireAuth, commentLimiter, s.createComment)
	api.Put("/posts/:slug/reaction", s.requireAuth, s.togglePostReaction)
	api.Put("/comments/:id/reaction", s.requireAuth, s.toggleCommentReaction)
	api.Put("/comments/:id/pin", s.requireAuth, s.pinComment)
	api.Delete("/comments/:id", s.requireAuth, s.deleteComment)
	mine := api.Group("/me", s.requireAuth)
	mine.Put("/profile", s.updateProfile)
	mine.Put("/author-profile", s.updateAuthorProfile)
	mine.Put("/password", s.changePassword)
	mine.Post("/avatar", s.uploadAvatar)
	mine.Get("/posts", s.myListPosts)
	mine.Get("/posts/:id", s.myGetPost)
	mine.Get("/posts/:id/versions", s.myPostVersions)
	mine.Get("/posts/:id/draft", s.myGetPostDraft)
	mine.Put("/posts/:id/draft", s.mySavePostDraft)
	mine.Delete("/posts/:id/draft", s.myDeletePostDraft)
	mine.Post("/posts", s.createPost)
	mine.Put("/posts/:id", s.myUpdatePost)
	mine.Delete("/posts/:id", s.myDeletePost)
	mine.Post("/uploads", s.upload)
	mine.Post("/categories", s.saveCategory)
	mine.Put("/categories/:id", s.saveCategory)
	mine.Post("/tags", s.saveTag)
	mine.Put("/tags/:id", s.saveTag)
	mine.Delete("/tags/:id", s.deleteTag)
	mine.Get("/bookmarks", s.listBookmarks)
	mine.Get("/series", s.mySeries)
	mine.Get("/series/:id", s.myGetSeries)
	mine.Post("/series", s.saveSeries)
	mine.Put("/series/:id", s.saveSeries)
	mine.Delete("/series/:id", s.deleteSeries)
	mine.Put("/series/:id/posts", s.setSeriesPosts)
	mine.Put("/authors/:authorId/follow", s.followAuthor)
	mine.Get("/recommendations", s.personalRecommendations)
	mine.Get("/todos", s.listTodos)
	mine.Get("/targets", s.listTargets)
	mine.Post("/targets", s.createTarget)
	mine.Put("/targets/:id", s.updateTarget)
	mine.Delete("/targets/:id", s.deleteTarget)
	mine.Post("/targets/:id/share", s.shareTarget)
	mine.Post("/targets/:id/todos", s.createTargetTodo)
	mine.Post("/todos", s.createTodo)
	mine.Put("/todos/:id", s.updateTodo)
	mine.Put("/todos/:id/check", s.checkTodo)
	mine.Delete("/todos/:id", s.deleteTodo)
	mine.Delete("/authors/:authorId/follow", s.unfollowAuthor)
	mine.Put("/bookmarks/:postId", s.addBookmark)
	mine.Delete("/bookmarks/:postId", s.removeBookmark)
	admin := api.Group("/admin", s.requireAuth, s.requireAdmin)
	admin.Get("/posts", s.adminListPosts)
	admin.Get("/posts/:id", s.adminGetPost)
	admin.Post("/posts", s.createPost)
	admin.Put("/posts/:id", s.updatePost)
	admin.Delete("/posts/:id", s.deletePost)
	admin.Post("/uploads", s.upload)
	admin.Post("/categories", s.saveCategory)
	admin.Put("/categories/:id", s.saveCategory)
	admin.Delete("/categories/:id", s.deleteCategory)
	admin.Post("/tags", s.saveTag)
	admin.Put("/tags/:id", s.saveTag)
	admin.Delete("/tags/:id", s.deleteTag)
	admin.Get("/comments", s.adminComments)
	admin.Get("/dashboard", s.adminDashboard)
	admin.Put("/comments/:id/status", s.commentStatus)
	admin.Delete("/comments/:id", s.adminDeleteComment)
	// Serve Vite's fingerprinted JavaScript, CSS and other public assets before
	// the SPA fallback below. Without this, /assets/* receives index.html.
	a.Static("/assets", "dist/assets")
	a.Get("/*", func(c *fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/api/") {
			return fiber.ErrNotFound
		}
		return c.SendFile("dist/index.html")
	})
}
func (s *Server) sitemap(c *fiber.Ctx) error {
	ctx := c.UserContext()
	posts := []model.Post{}
	for page := 1; ; page++ {
		batch, total, err := s.posts.List(ctx, repository.PostFilter{Status: "public", Page: page, Limit: 100})
		if err != nil {
			return err
		}
		posts = append(posts, batch...)
		if len(posts) >= int(total) || len(batch) == 0 {
			break
		}
	}
	categories, err := s.taxonomy.Categories(ctx)
	if err != nil {
		return err
	}
	tags, err := s.taxonomy.Tags(ctx)
	if err != nil {
		return err
	}
	seriesValues, err := s.series.List(ctx, primitive.NilObjectID, true, false)
	if err != nil {
		return err
	}
	base := strings.TrimSuffix(s.cfg.ClientOrigin, "/")
	var body strings.Builder
	body.WriteString(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	writeURL := func(path string, updated time.Time) {
		body.WriteString("<url><loc>")
		_ = xml.EscapeText(&body, []byte(base+path))
		body.WriteString("</loc>")
		if !updated.IsZero() {
			body.WriteString("<lastmod>" + updated.Format("2006-01-02") + "</lastmod>")
		}
		body.WriteString("</url>")
	}
	for _, path := range []string{"/", "/blog", "/about", "/privacy", "/socials", "/discussions"} {
		writeURL(path, time.Time{})
	}
	for _, postValue := range posts {
		writeURL("/blog/"+postValue.Slug, postValue.UpdatedAt)
	}
	for _, value := range categories {
		writeURL("/categories/"+value.Slug, value.UpdatedAt)
	}
	for _, value := range tags {
		writeURL("/tags/"+value.Slug, value.UpdatedAt)
	}
	for _, value := range seriesValues {
		writeURL("/series/"+value.Slug, value.UpdatedAt)
	}
	body.WriteString("</urlset>")
	c.Type("application/xml")
	return c.SendString(body.String())
}

func (s *Server) forgotPassword(c *fiber.Ctx) error {
	var input struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	token, err := s.auth.RequestPasswordReset(c.UserContext(), input.Email)
	if err != nil {
		return err
	}
	if token != "" {
		resetURL := strings.TrimSuffix(s.cfg.ClientOrigin, "/") + "/reset-password?token=" + token
		if s.cfg.SMTPHost != "" && s.cfg.SMTPFrom != "" {
			auth := smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
			message := []byte("To: " + input.Email + "\r\nSubject: Reset your Lumina password\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nOpen this one-time link within one hour:\r\n" + resetURL)
			if err := smtp.SendMail(s.cfg.SMTPHost+":"+s.cfg.SMTPPort, auth, s.cfg.SMTPFrom, []string{input.Email}, message); err != nil {
				log.Printf("send password reset email: %v", err)
			}
		} else if s.cfg.Env != "production" {
			log.Printf("development password reset URL: %s", resetURL)
		} else {
			log.Printf("password reset email not sent: SMTP is not configured")
		}
	}
	return success(c, 200, fiber.Map{"message": "If that account exists, reset instructions have been sent."})
}
func (s *Server) resetPassword(c *fiber.Ctx) error {
	var input struct {
		Token           string `json:"token"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirm_password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if err := s.auth.ResetPassword(c.UserContext(), input.Token, input.Password, input.ConfirmPassword); err != nil {
		return fiber.NewError(422, err.Error())
	}
	return c.SendStatus(204)
}
func (s *Server) listBookmarks(c *fiber.Ctx) error {
	if s.bookmarks == nil {
		return fiber.NewError(503, "bookmarks unavailable")
	}
	ids, err := s.bookmarks.ListPostIDs(c.UserContext(), c.Locals("user_id").(primitive.ObjectID))
	if err != nil {
		return err
	}
	posts := make([]model.Post, 0, len(ids))
	if batchRepo, ok := s.posts.Repo.(interface {
		FindPublicByIDs(context.Context, []primitive.ObjectID) ([]model.Post, error)
	}); ok {
		posts, err = batchRepo.FindPublicByIDs(c.UserContext(), ids)
		if err != nil {
			return err
		}
	} else {
		for _, id := range ids {
			postValue, findErr := s.posts.Repo.FindByID(c.UserContext(), id)
			if findErr == nil && (postValue.Status == "public" || postValue.Status == "published") {
				posts = append(posts, *postValue)
			}
		}
	}
	order := make(map[primitive.ObjectID]int, len(ids))
	for index, id := range ids {
		order[id] = index
	}
	sort.SliceStable(posts, func(i, j int) bool { return order[posts[i].ID] < order[posts[j].ID] })
	s.populateAuthors(c.UserContext(), posts)
	return success(c, 200, fiber.Map{"post_ids": ids, "posts": posts})
}
func (s *Server) addBookmark(c *fiber.Ctx) error {
	if s.bookmarks == nil {
		return fiber.NewError(503, "bookmarks unavailable")
	}
	postID, err := primitive.ObjectIDFromHex(c.Params("postId"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	postValue, err := s.posts.Repo.FindByID(c.UserContext(), postID)
	if err != nil || (postValue.Status != "public" && postValue.Status != "published") {
		return fiber.ErrNotFound
	}
	err = s.bookmarks.Create(c.UserContext(), &model.Bookmark{UserID: c.Locals("user_id").(primitive.ObjectID), PostID: postID, CreatedAt: time.Now().UTC()})
	if err != nil {
		return err
	}
	return c.SendStatus(204)
}
func (s *Server) removeBookmark(c *fiber.Ctx) error {
	if s.bookmarks == nil {
		return fiber.NewError(503, "bookmarks unavailable")
	}
	postID, err := primitive.ObjectIDFromHex(c.Params("postId"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if err = s.bookmarks.Delete(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), postID); err != nil {
		return err
	}
	return c.SendStatus(204)
}

type credentials struct {
	Name                string   `json:"name"`
	Email               string   `json:"email"`
	Password            string   `json:"password"`
	InterestCategoryIDs []string `json:"interest_category_ids"`
}

func (s *Server) register(c *fiber.Ctx) error {
	var in credentials
	if e := c.BodyParser(&in); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	interests := make([]primitive.ObjectID, 0, len(in.InterestCategoryIDs))
	for _, raw := range in.InterestCategoryIDs {
		if id, err := primitive.ObjectIDFromHex(raw); err == nil {
			interests = append(interests, id)
		}
	}
	t, e := s.auth.Register(c.UserContext(), in.Name, in.Email, in.Password, interests)
	if e != nil {
		return fiber.NewError(422, e.Error())
	}
	s.cookie(c, t.Refresh)
	return success(c, 201, fiber.Map{"access_token": t.Access, "user": t.User})
}
func (s *Server) login(c *fiber.Ctx) error {
	var in credentials
	if e := c.BodyParser(&in); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	t, e := s.auth.Login(c.UserContext(), in.Email, in.Password)
	if e != nil {
		return fiber.NewError(401, "Invalid email or password")
	}
	s.cookie(c, t.Refresh)
	return success(c, 200, fiber.Map{"access_token": t.Access, "user": t.User})
}
func (s *Server) refresh(c *fiber.Ctx) error {
	raw := c.Cookies("lumina_refresh")
	if raw == "" {
		return fiber.ErrUnauthorized
	}
	t, e := s.auth.Refresh(c.UserContext(), raw)
	if e != nil {
		return fiber.ErrUnauthorized
	}
	s.cookie(c, t.Refresh)
	return success(c, 200, fiber.Map{"access_token": t.Access, "user": t.User})
}
func (s *Server) logout(c *fiber.Ctx) error {
	if raw := c.Cookies("lumina_refresh"); raw != "" {
		_ = s.auth.Logout(c.UserContext(), raw)
	}
	c.Cookie(&fiber.Cookie{Name: "lumina_refresh", Value: "", HTTPOnly: true, Expires: time.Unix(0, 0), SameSite: "Lax"})
	return c.SendStatus(204)
}
func (s *Server) cookie(c *fiber.Ctx, v string) {
	c.Cookie(&fiber.Cookie{Name: "lumina_refresh", Value: v, HTTPOnly: true, Secure: s.cfg.Env == "production", SameSite: "Lax", Path: "/api/auth", Expires: time.Now().Add(s.cfg.RefreshTTL)})
}
func (s *Server) me(c *fiber.Ctx) error { return success(c, 200, c.Locals("user")) }
func (s *Server) listPosts(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	filter, e := postFilter(c, "public", page, limit)
	if e != nil {
		return e
	}
	items, total, e := s.posts.List(c.UserContext(), filter)
	if e != nil {
		return e
	}
	s.populateAuthors(c.UserContext(), items)
	// List views only render post metadata. Keep full content on the detail API.
	for i := range items {
		items[i].Content = ""
		items[i].Reactions = nil
	}
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}

func etagPublicAPI(path string) bool {
	if path == "/api/posts" || path == "/api/categories" || path == "/api/tags" || path == "/api/series" {
		return true
	}
	for _, prefix := range []string{"/api/posts/", "/api/categories/", "/api/tags/", "/api/series/"} {
		if strings.HasPrefix(path, prefix) {
			return prefix != "/api/posts/" || (!strings.HasSuffix(path, "/comments") && !strings.HasSuffix(path, "/series"))
		}
	}
	return false
}

func cacheHeaders(c *fiber.Ctx) error {
	if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead {
		c.Set(fiber.HeaderCacheControl, "no-store")
		return c.Next()
	}
	path := c.Path()
	switch {
	case strings.HasPrefix(path, "/assets/"):
		c.Set(fiber.HeaderCacheControl, "public, max-age=31536000, immutable")
	case strings.HasPrefix(path, "/uploads/"):
		c.Set(fiber.HeaderCacheControl, "public, max-age=2592000, immutable")
	case path == "/api/categories" || path == "/api/tags" || strings.HasPrefix(path, "/api/categories/") || strings.HasPrefix(path, "/api/tags/"):
		c.Set(fiber.HeaderCacheControl, "public, max-age=300, stale-while-revalidate=3600")
	case path == "/api/posts":
		c.Set(fiber.HeaderCacheControl, "public, max-age=30, stale-while-revalidate=120")
	case strings.HasPrefix(path, "/api/posts/") && !strings.HasSuffix(path, "/comments") && !strings.HasSuffix(path, "/series"):
		c.Set(fiber.HeaderCacheControl, "public, max-age=60, stale-while-revalidate=300")
	case path == "/api/series" || strings.HasPrefix(path, "/api/series/"):
		c.Set(fiber.HeaderCacheControl, "public, max-age=60, stale-while-revalidate=300")
	case strings.HasPrefix(path, "/api/"):
		c.Set(fiber.HeaderCacheControl, "private, no-store")
	default:
		c.Set(fiber.HeaderCacheControl, "no-cache")
	}
	return c.Next()
}
func (s *Server) getPost(c *fiber.Ctx) error {
	p, e := s.posts.Get(c.UserContext(), c.Params("slug"))
	if e != nil {
		return fiber.ErrNotFound
	}
	if u, err := s.auth.Users.FindByID(c.UserContext(), p.AuthorID); err == nil {
		p.Author = model.ToPublicUserDTO(u)
	}
	return success(c, 200, p)
}
func (s *Server) populateAuthors(ctx context.Context, posts []model.Post) {
	seen := map[primitive.ObjectID]*model.PublicUserDTO{}
	for i := range posts {
		aid := posts[i].AuthorID
		if aid.IsZero() {
			continue
		}
		if u, ok := seen[aid]; ok {
			posts[i].Author = u
			continue
		}
		if u, err := s.auth.Users.FindByID(ctx, aid); err == nil {
			publicUser := model.ToPublicUserDTO(u)
			seen[aid] = publicUser
			posts[i].Author = publicUser
		}
	}
}
func (s *Server) populateCommentUsers(ctx context.Context, comments []model.Comment) {
	seen := map[primitive.ObjectID]*model.PublicUserDTO{}
	ids := make([]primitive.ObjectID, 0)
	unique := map[primitive.ObjectID]bool{}
	for _, commentValue := range comments {
		if !commentValue.UserID.IsZero() && !unique[commentValue.UserID] {
			unique[commentValue.UserID] = true
			ids = append(ids, commentValue.UserID)
		}
	}
	if batch, ok := s.auth.Users.(repository.UserBatchRepository); ok {
		if users, err := batch.FindByIDs(ctx, ids); err == nil {
			for index := range users {
				userValue := users[index]
				seen[userValue.ID] = model.ToPublicUserDTO(&userValue)
			}
		}
	}
	for index := range comments {
		id := comments[index].UserID
		if userValue, ok := seen[id]; ok {
			comments[index].User = userValue
			continue
		}
		if userValue, err := s.auth.Users.FindByID(ctx, id); err == nil {
			publicUser := model.ToPublicUserDTO(userValue)
			seen[id] = publicUser
			comments[index].User = publicUser
		}
	}
}
func (s *Server) adminListPosts(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status")
	if status != "" && status != "private" && status != "public" {
		return fiber.NewError(422, "invalid post status")
	}
	filter, err := postFilter(c, status, page, limit)
	if err != nil {
		return err
	}
	items, total, err := s.posts.List(c.UserContext(), filter)
	if err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}
func (s *Server) updateProfile(c *fiber.Ctx) error {
	var input struct {
		Name                string   `json:"name"`
		Phone               string   `json:"phone"`
		InterestCategoryIDs []string `json:"interest_category_ids"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	interests := make([]primitive.ObjectID, 0, len(input.InterestCategoryIDs))
	for _, raw := range input.InterestCategoryIDs {
		if id, parseErr := primitive.ObjectIDFromHex(raw); parseErr == nil {
			interests = append(interests, id)
		}
	}
	u, err := s.auth.UpdateProfile(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), input.Name, input.Phone, interests)
	if err != nil {
		return fiber.NewError(422, err.Error())
	}
	return success(c, 200, u)
}
func (s *Server) changePassword(c *fiber.Ctx) error {
	var input struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
		ConfirmPassword string `json:"confirm_password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if err := s.auth.ChangePassword(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), input.CurrentPassword, input.NewPassword, input.ConfirmPassword); err != nil {
		return fiber.NewError(422, err.Error())
	}
	return c.SendStatus(204)
}
func (s *Server) uploadAvatar(c *fiber.Ctx) error {
	f, err := c.FormFile("file")
	if err != nil {
		return bad("FILE_REQUIRED", "Avatar image is required")
	}
	if f.Size > 3*1024*1024 {
		return fiber.NewError(422, "Avatar must be 3 MB or smaller")
	}
	ext, _, err := validateImage(f)
	if err != nil {
		return fiber.NewError(422, err.Error())
	}
	src, err := f.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	userID := c.Locals("user_id").(primitive.ObjectID)
	object, err := s.storage.Upload(c.UserContext(), filepath.Join("avatars", userID.Hex(), uuid.NewString()+ext), src)
	if err != nil {
		return err
	}
	u, err := s.auth.UpdateAvatar(c.UserContext(), userID, object.URL)
	if err != nil {
		_ = s.storage.Delete(c.UserContext(), object.Key)
		return err
	}
	return success(c, 200, u)
}
func (s *Server) adminGetPost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	p, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	return success(c, 200, p)
}
func (s *Server) myListPosts(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status")
	if status != "" && status != "private" && status != "public" {
		return fiber.NewError(422, "invalid post status")
	}
	filter, err := postFilter(c, status, page, limit)
	if err != nil {
		return err
	}
	if c.Locals("role") != "admin" {
		filter.AuthorID = c.Locals("user_id").(primitive.ObjectID)
	}
	items, total, err := s.posts.List(c.UserContext(), filter)
	if err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}
func postFilter(c *fiber.Ctx, status string, page, limit int) (repository.PostFilter, error) {
	filter := repository.PostFilter{Status: status, Search: c.Query("q"), Category: c.Query("category"), Tag: c.Query("tag"), Page: page, Limit: limit, FeaturedOnly: c.Query("featured") == "true"}
	if raw := c.Query("from"); raw != "" {
		value, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return filter, fiber.NewError(422, "invalid start date")
		}
		filter.DateFrom = value.UTC()
	}
	if raw := c.Query("to"); raw != "" {
		value, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return filter, fiber.NewError(422, "invalid end date")
		}
		filter.DateTo = value.UTC().Add(24*time.Hour - time.Nanosecond)
	}
	return filter, nil
}
func (s *Server) canManagePost(c *fiber.Ctx, p *model.Post) bool {
	return c.Locals("role") == "admin" || p.AuthorID == c.Locals("user_id").(primitive.ObjectID)
}
func (s *Server) myGetPost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	p, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	if !s.canManagePost(c, p) {
		return fiber.ErrForbidden
	}
	return success(c, 200, p)
}
func (s *Server) myPostVersions(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	p, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	if !s.canManagePost(c, p) {
		return fiber.ErrForbidden
	}
	versions, err := s.posts.ListVersions(c.UserContext(), id)
	if err != nil {
		return err
	}
	return success(c, 200, versions)
}
func (s *Server) draftRepo() (repository.PostDraftRepository, bool) {
	repo, ok := s.posts.Repo.(repository.PostDraftRepository)
	return repo, ok
}
func (s *Server) managedPost(c *fiber.Ctx) (primitive.ObjectID, *model.Post, error) {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return id, nil, bad("INVALID_ID", "Invalid identifier")
	}
	p, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return id, nil, fiber.ErrNotFound
	}
	if !s.canManagePost(c, p) {
		return id, nil, fiber.ErrForbidden
	}
	return id, p, nil
}
func (s *Server) myGetPostDraft(c *fiber.Ctx) error {
	id, postValue, err := s.managedPost(c)
	if err != nil {
		return err
	}
	repo, ok := s.draftRepo()
	if !ok {
		return fiber.NewError(503, "autosave unavailable")
	}
	draft, err := repo.GetDraft(c.UserContext(), id)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return c.SendStatus(204)
	}
	if err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"draft": draft, "newer": draft.UpdatedAt.After(postValue.UpdatedAt)})
}
func (s *Server) mySavePostDraft(c *fiber.Ctx) error {
	id, _, err := s.managedPost(c)
	if err != nil {
		return err
	}
	var draft model.PostDraft
	if err = c.BodyParser(&draft); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if draft.Sequence < 1 {
		return fiber.NewError(422, "invalid autosave sequence")
	}
	draft.UpdatedAt = time.Now().UTC()
	repo, ok := s.draftRepo()
	if !ok {
		return fiber.NewError(503, "autosave unavailable")
	}
	accepted, err := repo.SaveDraft(c.UserContext(), id, &draft)
	if err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"accepted": accepted, "sequence": draft.Sequence, "updated_at": draft.UpdatedAt})
}
func (s *Server) myDeletePostDraft(c *fiber.Ctx) error {
	id, _, err := s.managedPost(c)
	if err != nil {
		return err
	}
	repo, ok := s.draftRepo()
	if !ok {
		return fiber.NewError(503, "autosave unavailable")
	}
	if err = repo.DeleteDraft(c.UserContext(), id); err != nil {
		return err
	}
	return c.SendStatus(204)
}
func (s *Server) myUpdatePost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	existing, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	if !s.canManagePost(c, existing) {
		return fiber.ErrForbidden
	}
	var input model.Post
	if err = c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if err = s.posts.Update(c.UserContext(), id, &input); err != nil {
		return fiber.NewError(422, err.Error())
	}
	saved, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return err
	}
	return success(c, 200, saved)
}
func (s *Server) myDeletePost(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	p, err := s.posts.GetAdmin(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	if !s.canManagePost(c, p) {
		return fiber.ErrForbidden
	}
	if err = s.posts.Repo.Delete(c.UserContext(), id); err != nil {
		return err
	}
	return c.SendStatus(204)
}
func (s *Server) createPost(c *fiber.Ctx) error {
	var p model.Post
	if e := c.BodyParser(&p); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	p.AuthorID = c.Locals("user_id").(primitive.ObjectID)
	if e := s.posts.Create(c.UserContext(), &p); e != nil {
		return fiber.NewError(422, e.Error())
	}
	return success(c, 201, p)
}
func (s *Server) updatePost(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var p model.Post
	if e = c.BodyParser(&p); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if e = s.posts.Update(c.UserContext(), id, &p); e != nil {
		return fiber.NewError(422, e.Error())
	}
	saved, e := s.posts.GetAdmin(c.UserContext(), id)
	if e != nil {
		return e
	}
	return success(c, 200, saved)
}
func (s *Server) deletePost(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if e = s.posts.Repo.Delete(c.UserContext(), id); e != nil {
		return e
	}
	return c.SendStatus(204)
}
func (s *Server) listComments(c *fiber.Ctx) error {
	v, e := s.comments.List(c.UserContext(), c.Params("slug"))
	if e != nil {
		return fiber.ErrNotFound
	}
	s.populateCommentUsers(c.UserContext(), v)
	return success(c, 200, v)
}
func (s *Server) createComment(c *fiber.Ctx) error {
	var in struct {
		Content    string   `json:"content"`
		ParentID   string   `json:"parent_id"`
		MentionIDs []string `json:"mention_ids"`
	}
	if e := c.BodyParser(&in); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	var parentID primitive.ObjectID
	if in.ParentID != "" {
		var err error
		parentID, err = primitive.ObjectIDFromHex(in.ParentID)
		if err != nil {
			return bad("INVALID_PARENT", "Invalid parent comment")
		}
	}
	mentions := make([]primitive.ObjectID, 0, len(in.MentionIDs))
	for _, raw := range in.MentionIDs {
		if id, err := primitive.ObjectIDFromHex(raw); err == nil {
			mentions = append(mentions, id)
		}
	}
	v, e := s.comments.Create(c.UserContext(), c.Params("slug"), c.Locals("user_id").(primitive.ObjectID), in.Content, parentID, mentions)
	if e != nil {
		return fiber.NewError(422, e.Error())
	}
	if userValue, err := s.auth.Users.FindByID(c.UserContext(), v.UserID); err == nil {
		v.User = model.ToPublicUserDTO(userValue)
	}
	return success(c, 201, v)
}
func validReaction(value string) bool {
	return value == "insightful" || value == "beautiful" || value == "useful"
}
func (s *Server) togglePostReaction(c *fiber.Ctx) error {
	p, err := s.posts.Get(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fiber.ErrNotFound
	}
	var input struct {
		Type string `json:"type"`
	}
	if err = c.BodyParser(&input); err != nil || !validReaction(input.Type) {
		return fiber.NewError(422, "invalid reaction")
	}
	repo, ok := s.posts.Repo.(repository.PostReactionRepository)
	if !ok {
		return fiber.NewError(503, "reactions unavailable")
	}
	updated, err := repo.TogglePostReaction(c.UserContext(), p.ID, c.Locals("user_id").(primitive.ObjectID), input.Type)
	if err != nil {
		return err
	}
	return success(c, 200, updated.Reactions)
}
func (s *Server) toggleCommentReaction(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		Type string `json:"type"`
	}
	if err = c.BodyParser(&input); err != nil || !validReaction(input.Type) {
		return fiber.NewError(422, "invalid reaction")
	}
	repo, ok := s.comments.Comments.(repository.CommentInteractionRepository)
	if !ok {
		return fiber.NewError(503, "reactions unavailable")
	}
	updated, err := repo.ToggleCommentReaction(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), input.Type)
	if err != nil {
		return err
	}
	return success(c, 200, updated.Reactions)
}
func (s *Server) pinComment(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	commentValue, err := s.comments.Comments.FindByID(c.UserContext(), id)
	if err != nil {
		return fiber.ErrNotFound
	}
	postValue, err := s.posts.Repo.FindByID(c.UserContext(), commentValue.PostID)
	if err != nil {
		return fiber.ErrNotFound
	}
	if postValue.AuthorID != c.Locals("user_id").(primitive.ObjectID) {
		return fiber.ErrForbidden
	}
	var input struct {
		Pinned bool `json:"pinned"`
	}
	if err = c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	repo, ok := s.comments.Comments.(repository.CommentInteractionRepository)
	if !ok {
		return fiber.NewError(503, "pinning unavailable")
	}
	if err = repo.PinComment(c.UserContext(), commentValue.PostID, id, input.Pinned); err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"id": id, "is_pinned": input.Pinned})
}
func (s *Server) deleteComment(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if e = s.comments.Delete(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), c.Locals("role") == "admin"); e != nil {
		return fiber.NewError(403, e.Error())
	}
	return c.SendStatus(204)
}
func (s *Server) listCategories(c *fiber.Ctx) error {
	v, e := s.taxonomy.Categories(c.UserContext())
	if e != nil {
		return e
	}
	return success(c, 200, v)
}
func (s *Server) getCategory(c *fiber.Ctx) error {
	v, e := s.taxonomy.Category(c.UserContext(), c.Params("slug"))
	if e != nil {
		return fiber.ErrNotFound
	}
	return success(c, 200, v)
}
func (s *Server) listTags(c *fiber.Ctx) error {
	v, e := s.taxonomy.Tags(c.UserContext())
	if e != nil {
		return e
	}
	return success(c, 200, v)
}
func (s *Server) getTag(c *fiber.Ctx) error {
	v, e := s.taxonomy.Tag(c.UserContext(), c.Params("slug"))
	if e != nil {
		return fiber.ErrNotFound
	}
	return success(c, 200, v)
}
func parseOptionalID(v string) (primitive.ObjectID, error) {
	if v == "" {
		return primitive.NilObjectID, nil
	}
	return primitive.ObjectIDFromHex(v)
}
func (s *Server) saveCategory(c *fiber.Ctx) error {
	id, e := parseOptionalID(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var v model.Category
	if e = c.BodyParser(&v); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if e = s.taxonomy.SaveCategory(c.UserContext(), id, &v); e != nil {
		return fiber.NewError(422, e.Error())
	}
	status := 200
	if id.IsZero() {
		status = 201
	}
	return success(c, status, v)
}
func (s *Server) deleteCategory(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if e = s.taxonomy.Repo.DeleteCategory(c.UserContext(), id); e != nil {
		return e
	}
	return c.SendStatus(204)
}
func (s *Server) saveTag(c *fiber.Ctx) error {
	id, e := parseOptionalID(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var v model.Tag
	if e = c.BodyParser(&v); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	if e = s.taxonomy.SaveTag(c.UserContext(), id, &v); e != nil {
		return fiber.NewError(422, e.Error())
	}
	status := 200
	if id.IsZero() {
		status = 201
	}
	return success(c, status, v)
}
func (s *Server) deleteTag(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if e = s.taxonomy.Repo.DeleteTag(c.UserContext(), id); e != nil {
		return e
	}
	return c.SendStatus(204)
}
func (s *Server) adminComments(c *fiber.Ctx) error {
	v, e := s.comments.Comments.List(c.UserContext())
	if e != nil {
		return e
	}
	return success(c, 200, v)
}
func (s *Server) adminDashboard(c *fiber.Ctx) error {
	ctx := c.UserContext()
	recent, total, err := s.posts.List(ctx, repository.PostFilter{Page: 1, Limit: 5})
	if err != nil {
		return err
	}
	_, published, err := s.posts.List(ctx, repository.PostFilter{Status: "public", Page: 1, Limit: 1})
	if err != nil {
		return err
	}
	_, private, err := s.posts.List(ctx, repository.PostFilter{Status: "private", Page: 1, Limit: 1})
	if err != nil {
		return err
	}
	comments, err := s.comments.Comments.List(ctx)
	if err != nil {
		return err
	}
	categories, err := s.taxonomy.Categories(ctx)
	if err != nil {
		return err
	}
	tags, err := s.taxonomy.Tags(ctx)
	if err != nil {
		return err
	}
	return success(c, 200, fiber.Map{"posts": total, "published": published, "private": private, "comments": len(comments), "categories": len(categories), "tags": len(tags), "recent_posts": recent})
}
func (s *Server) commentStatus(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var v struct {
		Status string `json:"status"`
	}
	if e = c.BodyParser(&v); e != nil || (v.Status != "approved" && v.Status != "pending" && v.Status != "rejected") {
		return fiber.NewError(422, "invalid comment status")
	}
	if e = s.comments.Comments.UpdateStatus(c.UserContext(), id, v.Status); e != nil {
		return e
	}
	return success(c, 200, fiber.Map{"id": id, "status": v.Status})
}
func (s *Server) adminDeleteComment(c *fiber.Ctx) error {
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if e = s.comments.Comments.Delete(c.UserContext(), id); e != nil {
		return e
	}
	return c.SendStatus(204)
}
func (s *Server) upload(c *fiber.Ctx) error {
	f, e := c.FormFile("file")
	if e != nil {
		return bad("FILE_REQUIRED", "Image is required")
	}
	if f.Size > 5*1024*1024 {
		return fiber.NewError(422, "Image must be 5 MB or smaller")
	}
	ext, mime, e := validateImage(f)
	if e != nil {
		return fiber.NewError(422, e.Error())
	}
	_ = mime
	src, e := f.Open()
	if e != nil {
		return e
	}
	defer src.Close()
	obj, e := s.storage.Upload(c.UserContext(), filepath.Join("posts", uuid.NewString()+ext), src)
	if e != nil {
		return e
	}
	return success(c, 201, obj)
}
func validateImage(f *multipart.FileHeader) (string, string, error) {
	src, e := f.Open()
	if e != nil {
		return "", "", e
	}
	defer src.Close()
	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	mime := http.DetectContentType(buf[:n])
	allowed := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
	ext, ok := allowed[mime]
	if !ok {
		return "", "", errors.New("only JPEG, PNG and WebP images are allowed")
	}
	return ext, mime, nil
}
func (s *Server) requireAuth(c *fiber.Ctx) error {
	raw := strings.TrimPrefix(c.Get("Authorization"), "Bearer ")
	if raw == "" {
		return fiber.ErrUnauthorized
	}
	id, role, e := s.auth.ParseAccess(raw)
	if e != nil {
		return fiber.ErrUnauthorized
	}
	u, e := s.auth.Users.FindByID(c.UserContext(), id)
	if e != nil {
		return fiber.ErrUnauthorized
	}
	c.Locals("user_id", id)
	c.Locals("role", role)
	c.Locals("user", u)
	return c.Next()
}
func (s *Server) requireAdmin(c *fiber.Ctx) error {
	if c.Locals("role") != "admin" {
		return fiber.ErrForbidden
	}
	return c.Next()
}

type apiErr struct{ Code, Message string }

func (e apiErr) Error() string   { return e.Message }
func bad(code, msg string) error { return apiErr{code, msg} }
func success(c *fiber.Ctx, status int, data any) error {
	return c.Status(status).JSON(fiber.Map{"data": data, "message": "success"})
}
func (s *Server) errors(c *fiber.Ctx, err error) error {
	status := 500
	code := "INTERNAL_ERROR"
	message := "An internal error occurred"
	var fe *fiber.Error
	if errors.As(err, &fe) {
		status = fe.Code
		message = fe.Message
		code = strings.ToUpper(strings.ReplaceAll(fe.Message, " ", "_"))
	}
	var ae apiErr
	if errors.As(err, &ae) {
		status = 400
		code = ae.Code
		message = ae.Message
	}
	if status >= 500 {
		log.Printf("request failed: %v", err)
	}
	return c.Status(status).JSON(fiber.Map{"error": fiber.Map{"code": code, "message": message}})
}
