package api

import (
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"lumina/src/domain/model"
)

func pageValues(c *fiber.Ctx) (int, int) {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 10)
	if limit < 1 || limit > 50 {
		limit = 10
	}
	return page, limit
}
func (s *Server) featureDB() (*mongo.Database, error) {
	if s.db == nil {
		return nil, fiber.NewError(503, "feature storage unavailable")
	}
	return s.db, nil
}

func (s *Server) listTodos(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	q := bson.M{"user_id": uid}
	if status := c.Query("status"); status == "completed" {
		q["completed"] = true
	} else if status == "active" {
		q["completed"] = false
	}
	if term := strings.TrimSpace(c.Query("q")); term != "" {
		q["$or"] = []bson.M{{"title": bson.M{"$regex": regexp.QuoteMeta(term), "$options": "i"}}, {"notes": bson.M{"$regex": regexp.QuoteMeta(term), "$options": "i"}}}
	}
	page, limit := pageValues(c)
	collection := db.Collection("todos")
	total, e := collection.CountDocuments(c.UserContext(), q)
	if e != nil {
		return e
	}
	cursor, e := collection.Find(c.UserContext(), q, options.Find().SetSort(bson.D{{Key: "completed", Value: 1}, {Key: "created_at", Value: -1}}).SetSkip(int64((page-1)*limit)).SetLimit(int64(limit)))
	if e != nil {
		return e
	}
	var items []model.Todo
	if e = cursor.All(c.UserContext(), &items); e != nil {
		return e
	}
	if items == nil {
		items = []model.Todo{}
	}
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}
func (s *Server) createTodo(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	var input struct {
		Title string `json:"title"`
		Notes string `json:"notes"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Notes = strings.TrimSpace(input.Notes)
	if len(input.Title) < 1 || len(input.Title) > 160 || len(input.Notes) > 1000 {
		return fiber.NewError(422, "todo title or notes are invalid")
	}
	now := time.Now().UTC()
	value := model.Todo{ID: primitive.NewObjectID(), UserID: c.Locals("user_id").(primitive.ObjectID), Title: input.Title, Notes: input.Notes, CreatedAt: now, UpdatedAt: now}
	if _, e = db.Collection("todos").InsertOne(c.UserContext(), value); e != nil {
		return e
	}
	return success(c, 201, value)
}
func (s *Server) updateTodo(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		Title     string `json:"title"`
		Notes     string `json:"notes"`
		Completed bool   `json:"completed"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Notes = strings.TrimSpace(input.Notes)
	if input.Title == "" || len(input.Title) > 160 || len(input.Notes) > 1000 {
		return fiber.NewError(422, "todo title or notes are invalid")
	}
	filter := bson.M{"_id": id, "user_id": c.Locals("user_id").(primitive.ObjectID)}
	after := options.FindOneAndUpdate().SetReturnDocument(options.After)
	var value model.Todo
	e = db.Collection("todos").FindOneAndUpdate(c.UserContext(), filter, bson.M{"$set": bson.M{"title": input.Title, "notes": input.Notes, "completed": input.Completed, "updated_at": time.Now().UTC()}}, after).Decode(&value)
	if e == mongo.ErrNoDocuments {
		return fiber.ErrNotFound
	}
	if e != nil {
		return e
	}
	return success(c, 200, value)
}
func (s *Server) deleteTodo(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	result, e := db.Collection("todos").DeleteOne(c.UserContext(), bson.M{"_id": id, "user_id": c.Locals("user_id").(primitive.ObjectID)})
	if e != nil {
		return e
	}
	if result.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(204)
}

func containsID(values []primitive.ObjectID, id primitive.ObjectID) bool {
	for _, value := range values {
		if value == id {
			return true
		}
	}
	return false
}
func (s *Server) hydrateDiscussion(c *fiber.Ctx, value *model.Discussion) {
	value.InterestCount = len(value.InterestedIDs)
	value.CommentCount = len(value.Comments)
	value.Interested = containsID(value.InterestedIDs, s.optionalViewer(c))
	if userValue, e := s.auth.Users.FindByID(c.UserContext(), value.AuthorID); e == nil {
		value.Author = model.ToPublicUserDTO(userValue)
	}
	for index := range value.Comments {
		if userValue, e := s.auth.Users.FindByID(c.UserContext(), value.Comments[index].UserID); e == nil {
			value.Comments[index].User = model.ToPublicUserDTO(userValue)
		}
	}
}
func (s *Server) listDiscussions(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	q := bson.M{}
	if term := strings.TrimSpace(c.Query("q")); term != "" {
		q["$or"] = []bson.M{{"title": bson.M{"$regex": regexp.QuoteMeta(term), "$options": "i"}}, {"content": bson.M{"$regex": regexp.QuoteMeta(term), "$options": "i"}}}
	}
	if c.Query("interested") == "true" {
		viewer := s.optionalViewer(c)
		if viewer.IsZero() {
			return fiber.ErrUnauthorized
		}
		q["interested_ids"] = viewer
	}
	page, limit := pageValues(c)
	collection := db.Collection("discussions")
	total, e := collection.CountDocuments(c.UserContext(), q)
	if e != nil {
		return e
	}
	cursor, e := collection.Find(c.UserContext(), q, options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}}).SetSkip(int64((page-1)*limit)).SetLimit(int64(limit)))
	if e != nil {
		return e
	}
	var items []model.Discussion
	if e = cursor.All(c.UserContext(), &items); e != nil {
		return e
	}
	if items == nil {
		items = []model.Discussion{}
	}
	for index := range items {
		s.hydrateDiscussion(c, &items[index])
		items[index].Comments = nil
	}
	return success(c, 200, fiber.Map{"items": items, "page": page, "limit": limit, "total": total})
}
func (s *Server) getDiscussion(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var value model.Discussion
	if e = db.Collection("discussions").FindOne(c.UserContext(), bson.M{"_id": id}).Decode(&value); e != nil {
		return e
	}
	s.hydrateDiscussion(c, &value)
	return success(c, 200, value)
}
func (s *Server) createDiscussion(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	var input struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Content = strings.TrimSpace(input.Content)
	if len(input.Title) < 5 || len(input.Title) > 180 || len(input.Content) < 10 || len(input.Content) > 5000 {
		return fiber.NewError(422, "discussion title or content are invalid")
	}
	now := time.Now().UTC()
	value := model.Discussion{ID: primitive.NewObjectID(), AuthorID: c.Locals("user_id").(primitive.ObjectID), Title: input.Title, Content: input.Content, Comments: []model.DiscussionComment{}, InterestedIDs: []primitive.ObjectID{}, CreatedAt: now, UpdatedAt: now}
	if _, e = db.Collection("discussions").InsertOne(c.UserContext(), value); e != nil {
		return e
	}
	s.hydrateDiscussion(c, &value)
	return success(c, 201, value)
}
func (s *Server) commentDiscussion(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		Content string `json:"content"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Content = strings.TrimSpace(input.Content)
	if len(input.Content) < 1 || len(input.Content) > 3000 {
		return fiber.NewError(422, "comment is invalid")
	}
	value := model.DiscussionComment{ID: primitive.NewObjectID(), UserID: c.Locals("user_id").(primitive.ObjectID), Content: input.Content, CreatedAt: time.Now().UTC()}
	result, e := db.Collection("discussions").UpdateByID(c.UserContext(), id, bson.M{"$push": bson.M{"comments": value}, "$set": bson.M{"updated_at": time.Now().UTC()}})
	if e != nil {
		return e
	}
	if result.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	if userValue, e := s.auth.Users.FindByID(c.UserContext(), value.UserID); e == nil {
		value.User = model.ToPublicUserDTO(userValue)
	}
	return success(c, 201, value)
}
func (s *Server) toggleDiscussionInterest(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	var current model.Discussion
	if e = db.Collection("discussions").FindOne(c.UserContext(), bson.M{"_id": id}).Decode(&current); e != nil {
		return e
	}
	interested := !containsID(current.InterestedIDs, uid)
	update := bson.M{"$addToSet": bson.M{"interested_ids": uid}}
	if !interested {
		update = bson.M{"$pull": bson.M{"interested_ids": uid}}
	}
	if _, e = db.Collection("discussions").UpdateByID(c.UserContext(), id, update); e != nil {
		return e
	}
	count := len(current.InterestedIDs)
	if interested {
		count++
	} else {
		count--
	}
	return success(c, 200, fiber.Map{"interested": interested, "interest_count": count})
}
