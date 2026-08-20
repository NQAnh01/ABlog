package api

import (
	"context"
	"errors"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"log"
	"lumina/src/domain/comment"
	"lumina/src/domain/model"
	"lumina/src/domain/post"
	"lumina/src/domain/repository"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
	store "lumina/src/infrastructure/storage"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	App      *fiber.App
	auth     user.Service
	posts    post.Service
	comments comment.Service
	taxonomy taxonomy.Service
	storage  store.Storage
	cfg      config.Config
}

func New(cfg config.Config, a user.Service, p post.Service, c comment.Service, t taxonomy.Service, st store.Storage) *Server {
	s := &Server{auth: a, posts: p, comments: c, taxonomy: t, storage: st, cfg: cfg}
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
	a.Static("/uploads", s.cfg.StoragePath)
	api := a.Group("/api")
	auth := api.Group("/auth", limiter.New(limiter.Config{Max: 20, Expiration: time.Minute}))
	auth.Post("/register", s.register)
	auth.Post("/login", s.login)
	auth.Post("/refresh", s.refresh)
	auth.Post("/logout", s.logout)
	auth.Get("/me", s.requireAuth, s.me)
	api.Get("/posts", s.listPosts)
	api.Get("/posts/:slug", s.getPost)
	api.Get("/posts/:slug/comments", s.listComments)
	api.Get("/categories", s.listCategories)
	api.Get("/categories/:slug", s.getCategory)
	api.Get("/tags", s.listTags)
	api.Get("/tags/:slug", s.getTag)
	api.Post("/posts/:slug/comments", s.requireAuth, s.createComment)
	api.Delete("/comments/:id", s.requireAuth, s.deleteComment)
	mine := api.Group("/me", s.requireAuth)
	mine.Put("/profile", s.updateProfile)
	mine.Put("/password", s.changePassword)
	mine.Post("/avatar", s.uploadAvatar)
	mine.Get("/posts", s.myListPosts)
	mine.Get("/posts/:id", s.myGetPost)
	mine.Get("/posts/:id/versions", s.myPostVersions)
	mine.Post("/posts", s.createPost)
	mine.Put("/posts/:id", s.myUpdatePost)
	mine.Delete("/posts/:id", s.myDeletePost)
	mine.Post("/uploads", s.upload)
	mine.Post("/categories", s.saveCategory)
	mine.Put("/categories/:id", s.saveCategory)
	mine.Post("/tags", s.saveTag)
	mine.Put("/tags/:id", s.saveTag)
	mine.Delete("/tags/:id", s.deleteTag)
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

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) register(c *fiber.Ctx) error {
	var in credentials
	if e := c.BodyParser(&in); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	t, e := s.auth.Register(c.UserContext(), in.Name, in.Email, in.Password)
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
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}
func (s *Server) getPost(c *fiber.Ctx) error {
	p, e := s.posts.Get(c.UserContext(), c.Params("slug"))
	if e != nil {
		return fiber.ErrNotFound
	}
	if u, err := s.auth.Users.FindByID(c.UserContext(), p.AuthorID); err == nil {
		p.Author = u
	}
	return success(c, 200, p)
}
func (s *Server) populateAuthors(ctx context.Context, posts []model.Post) {
	seen := map[primitive.ObjectID]*model.User{}
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
			seen[aid] = u
			posts[i].Author = u
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
		Name  string `json:"name"`
		Phone string `json:"phone"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	u, err := s.auth.UpdateProfile(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), input.Name, input.Phone)
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
	filter := repository.PostFilter{Status: status, Search: c.Query("q"), Category: c.Query("category"), Tag: c.Query("tag"), Page: page, Limit: limit}
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
	return success(c, 200, v)
}
func (s *Server) createComment(c *fiber.Ctx) error {
	var in struct {
		Content string `json:"content"`
	}
	if e := c.BodyParser(&in); e != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	v, e := s.comments.Create(c.UserContext(), c.Params("slug"), c.Locals("user_id").(primitive.ObjectID), in.Content)
	if e != nil {
		return fiber.NewError(422, e.Error())
	}
	return success(c, 201, v)
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
