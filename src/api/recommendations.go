package api

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"strings"
)

func recommendationExcludes(c *fiber.Ctx) []primitive.ObjectID {
	values := []primitive.ObjectID{}
	for _, raw := range strings.Split(c.Query("exclude"), ",") {
		if id, err := primitive.ObjectIDFromHex(strings.TrimSpace(raw)); err == nil {
			values = append(values, id)
		}
	}
	return values
}
func (s *Server) contextRecommendations(c *fiber.Ctx) error {
	if s.recommendations == nil {
		return success(c, 200, []any{})
	}
	var currentID primitive.ObjectID
	if slug := strings.TrimSpace(c.Query("post")); slug != "" {
		value, err := s.posts.Get(c.UserContext(), slug)
		if err != nil {
			return fiber.ErrNotFound
		}
		currentID = value.ID
		items, err := s.recommendations.Recommend(c.UserContext(), s.optionalViewer(c), value, recommendationExcludes(c), 4)
		if err != nil {
			return err
		}
		s.populateAuthors(c.UserContext(), items)
		return success(c, 200, items)
	}
	items, err := s.recommendations.Recommend(c.UserContext(), s.optionalViewer(c), nil, recommendationExcludes(c), 4)
	if err != nil {
		return err
	}
	_ = currentID
	s.populateAuthors(c.UserContext(), items)
	return success(c, 200, items)
}
func (s *Server) personalRecommendations(c *fiber.Ctx) error {
	if s.recommendations == nil {
		return success(c, 200, []any{})
	}
	items, err := s.recommendations.Recommend(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), nil, recommendationExcludes(c), 4)
	if err != nil {
		return err
	}
	s.populateAuthors(c.UserContext(), items)
	return success(c, 200, items)
}
