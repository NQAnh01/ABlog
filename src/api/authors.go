package api

import (
	"net/url"
	"sort"
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
)

func (s *Server) authorByUsername(c *fiber.Ctx) (*model.User, error) {
	repo, ok := s.auth.Users.(repository.PublicAuthorRepository)
	if !ok {
		return nil, fiber.ErrNotFound
	}
	value, err := repo.FindByUsername(c.UserContext(), strings.ToLower(c.Params("username")))
	if err != nil {
		return nil, fiber.ErrNotFound
	}
	return value, nil
}

func (s *Server) publicAuthor(c *fiber.Ctx) error {
	author, err := s.authorByUsername(c)
	if err != nil {
		return err
	}
	posts, total, err := s.posts.List(c.UserContext(), repository.PostFilter{Status: "public", AuthorID: author.ID, Page: 1, Limit: 100})
	if err != nil {
		return err
	}
	sort.SliceStable(posts, func(i, j int) bool {
		if posts[i].IsPinnedOnProfile != posts[j].IsPinnedOnProfile {
			return posts[i].IsPinnedOnProfile
		}
		return posts[i].PublishedAt != nil && posts[j].PublishedAt != nil && posts[i].PublishedAt.After(*posts[j].PublishedAt)
	})
	seriesValues, err := s.series.List(c.UserContext(), author.ID, true, false)
	if err != nil {
		return err
	}
	followerCount := int64(0)
	if s.follows != nil {
		followerCount, _ = s.follows.Count(c.UserContext(), author.ID)
	}
	return success(c, 200, fiber.Map{"author": model.ToPublicUserDTO(author), "posts": posts, "series": seriesValues, "post_count": total, "follower_count": followerCount})
}

func (s *Server) optionalViewer(c *fiber.Ctx) primitive.ObjectID {
	raw := strings.TrimSpace(c.Get("Authorization"))
	if !strings.HasPrefix(raw, "Bearer ") {
		return primitive.NilObjectID
	}
	id, _, err := s.auth.ParseAccess(strings.TrimSpace(strings.TrimPrefix(raw, "Bearer ")))
	if err != nil {
		return primitive.NilObjectID
	}
	return id
}

func (s *Server) authorFollowStatus(c *fiber.Ctx) error {
	author, err := s.authorByUsername(c)
	if err != nil {
		return err
	}
	viewer := s.optionalViewer(c)
	following := false
	if s.follows != nil && !viewer.IsZero() {
		following, _ = s.follows.Exists(c.UserContext(), viewer, author.ID)
	}
	count := int64(0)
	if s.follows != nil {
		count, _ = s.follows.Count(c.UserContext(), author.ID)
	}
	return success(c, 200, fiber.Map{"following": following, "follower_count": count})
}

func (s *Server) followAuthor(c *fiber.Ctx) error {
	authorID, err := primitive.ObjectIDFromHex(c.Params("authorId"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	followerID := c.Locals("user_id").(primitive.ObjectID)
	if followerID == authorID {
		return fiber.NewError(422, "you cannot follow yourself")
	}
	if _, err = s.auth.Users.FindByID(c.UserContext(), authorID); err != nil {
		return fiber.ErrNotFound
	}
	if s.follows == nil {
		return fiber.NewError(503, "follow unavailable")
	}
	if err = s.follows.Create(c.UserContext(), &model.Follow{FollowerID: followerID, AuthorID: authorID}); err != nil {
		return err
	}
	count, _ := s.follows.Count(c.UserContext(), authorID)
	return success(c, 200, fiber.Map{"following": true, "follower_count": count})
}

func (s *Server) unfollowAuthor(c *fiber.Ctx) error {
	authorID, err := primitive.ObjectIDFromHex(c.Params("authorId"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	if s.follows == nil {
		return fiber.NewError(503, "follow unavailable")
	}
	if err = s.follows.Delete(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), authorID); err != nil {
		return err
	}
	count, _ := s.follows.Count(c.UserContext(), authorID)
	return success(c, 200, fiber.Map{"following": false, "follower_count": count})
}

func (s *Server) updateAuthorProfile(c *fiber.Ctx) error {
	var input struct {
		Bio         string            `json:"bio"`
		SocialLinks model.SocialLinks `json:"social_links"`
	}
	if err := c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Bio = strings.TrimSpace(input.Bio)
	if len(input.Bio) > 320 {
		return fiber.NewError(422, "bio must be 320 characters or fewer")
	}
	if len(input.SocialLinks.Links) > 8 {
		return fiber.NewError(422, "no more than 8 custom links are allowed")
	}
	validateURL := func(raw string) bool {
		if strings.TrimSpace(raw) == "" {
			return true
		}
		value, parseErr := url.ParseRequestURI(strings.TrimSpace(raw))
		return parseErr == nil && (value.Scheme == "http" || value.Scheme == "https") && value.Host != ""
	}
	if !validateURL(input.SocialLinks.Website) || !validateURL(input.SocialLinks.X) || !validateURL(input.SocialLinks.LinkedIn) {
		return fiber.NewError(422, "social links must use a valid http or https URL")
	}
	cleanLinks := make([]model.SocialLink, 0, len(input.SocialLinks.Links))
	for _, link := range input.SocialLinks.Links {
		link.Name, link.URL = strings.TrimSpace(link.Name), strings.TrimSpace(link.URL)
		if link.Name == "" && link.URL == "" {
			continue
		}
		if len(link.Name) > 40 || link.Name == "" || !validateURL(link.URL) || link.URL == "" {
			return fiber.NewError(422, "each custom link needs a name of 40 characters or fewer and a valid URL")
		}
		cleanLinks = append(cleanLinks, link)
	}
	input.SocialLinks.Links = cleanLinks
	repo, ok := s.auth.Users.(repository.PublicAuthorRepository)
	if !ok {
		return fiber.NewError(503, "author profiles unavailable")
	}
	id := c.Locals("user_id").(primitive.ObjectID)
	if err := repo.UpdateAuthorProfile(c.UserContext(), id, input.Bio, input.SocialLinks); err != nil {
		return err
	}
	value, err := s.auth.Users.FindByID(c.UserContext(), id)
	if err != nil {
		return err
	}
	return success(c, 200, value)
}
