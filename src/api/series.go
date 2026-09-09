package api

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
)

func (s *Server) listSeries(c *fiber.Ctx) error {
	values, err := s.series.List(c.UserContext(), primitive.NilObjectID, true, c.Query("featured") == "true")
	if err != nil {
		return err
	}
	for index := range values {
		s.populateAuthors(c.UserContext(), values[index].Posts)
	}
	return success(c, 200, values)
}
func (s *Server) getSeries(c *fiber.Ctx) error {
	value, err := s.series.GetPublic(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fiber.ErrNotFound
	}
	s.populateAuthors(c.UserContext(), value.Posts)
	return success(c, 200, value)
}
func (s *Server) postSeries(c *fiber.Ctx) error {
	postValue, err := s.posts.Get(c.UserContext(), c.Params("slug"))
	if err != nil {
		return fiber.ErrNotFound
	}
	value, err := s.series.ForPost(c.UserContext(), postValue.ID)
	if err != nil {
		return c.SendStatus(204)
	}
	return success(c, 200, value)
}
func (s *Server) mySeries(c *fiber.Ctx) error {
	values, err := s.series.List(c.UserContext(), c.Locals("user_id").(primitive.ObjectID), false, false)
	if err != nil {
		return err
	}
	return success(c, 200, values)
}
func (s *Server) myGetSeries(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	isStaff := c.Locals("role") == "admin" || c.Locals("role") == "editor"
	value, err := s.series.GetManaged(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), isStaff)
	if err != nil {
		return fiber.ErrForbidden
	}
	return success(c, 200, value)
}
func (s *Server) saveSeries(c *fiber.Ctx) error {
	id, err := parseOptionalID(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input model.Series
	if err = c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	isStaff := c.Locals("role") == "admin" || c.Locals("role") == "editor"
	value, err := s.series.Save(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), isStaff, &input)
	if err != nil {
		return fiber.NewError(422, err.Error())
	}
	status := 200
	if id.IsZero() {
		status = 201
	}
	return success(c, status, value)
}
func (s *Server) deleteSeries(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	isStaff := c.Locals("role") == "admin" || c.Locals("role") == "editor"
	if _, err = s.series.GetManaged(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), isStaff); err != nil {
		return fiber.ErrForbidden
	}
	if err = s.series.Repo.Delete(c.UserContext(), id); err != nil {
		return err
	}
	return c.SendStatus(204)
}
func (s *Server) setSeriesPosts(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		PostIDs []string `json:"post_ids"`
	}
	if err = c.BodyParser(&input); err != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	ids := make([]primitive.ObjectID, 0, len(input.PostIDs))
	for _, raw := range input.PostIDs {
		value, parseErr := primitive.ObjectIDFromHex(raw)
		if parseErr == nil {
			ids = append(ids, value)
		}
	}
	isStaff := c.Locals("role") == "admin" || c.Locals("role") == "editor"
	if err = s.series.SetPosts(c.UserContext(), id, c.Locals("user_id").(primitive.ObjectID), isStaff, ids); err != nil {
		return fiber.NewError(422, err.Error())
	}
	return c.SendStatus(204)
}
