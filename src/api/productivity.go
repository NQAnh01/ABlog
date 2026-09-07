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
	if c.Query("unassigned") == "true" {
		q["target_id"] = bson.M{"$exists": false}
	}
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

func parseTargetInput(c *fiber.Ctx) (string, string, time.Time, error) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		DueDate     string `json:"due_date"`
	}
	if c.BodyParser(&input) != nil {
		return "", "", time.Time{}, fiber.NewError(400, "invalid request")
	}
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	due, err := time.Parse("2006-01-02", input.DueDate)
	if input.Title == "" || len(input.Title) > 160 || len(input.Description) > 1000 || err != nil {
		return "", "", time.Time{}, fiber.NewError(422, "target title, description or due date is invalid")
	}
	return input.Title, input.Description, due.UTC(), nil
}

func (s *Server) listTargets(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	query := bson.M{"$or": []bson.M{{"user_id": uid}, {"shared_with": uid}}}
	if rawDate := strings.TrimSpace(c.Query("date")); rawDate != "" {
		if selected, parseErr := time.Parse("2006-01-02", rawDate); parseErr == nil {
			field := "due_date"
			if c.Query("date_type") == "created" {
				field = "created_at"
			}
			query[field] = bson.M{"$gte": selected.UTC(), "$lt": selected.Add(24 * time.Hour).UTC()}
		} else {
			return fiber.NewError(422, "target search date is invalid")
		}
	}
	cursor, e := db.Collection("targets").Find(c.UserContext(), query, options.Find().SetSort(bson.D{{Key: "due_date", Value: 1}}))
	if e != nil {
		return e
	}
	var values []model.Target
	if e = cursor.All(c.UserContext(), &values); e != nil {
		return e
	}
	if values == nil {
		values = []model.Target{}
	}
	targetIDs := make([]primitive.ObjectID, 0, len(values))
	for i := range values {
		targetIDs = append(targetIDs, values[i].ID)
		values[i].CanEdit = values[i].UserID == uid
		values[i].IsShared = values[i].UserID != uid
	}
	todoCursor, e := db.Collection("todos").Find(c.UserContext(), bson.M{"target_id": bson.M{"$in": targetIDs}}, options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}))
	if e != nil {
		return e
	}
	var todos []model.Todo
	if e = todoCursor.All(c.UserContext(), &todos); e != nil {
		return e
	}
	byTarget := map[primitive.ObjectID][]model.Todo{}
	for _, todo := range todos {
		byTarget[todo.TargetID] = append(byTarget[todo.TargetID], todo)
	}
	for i := range values {
		values[i].Todos = byTarget[values[i].ID]
		if values[i].Todos == nil {
			values[i].Todos = []model.Todo{}
		}
	}
	return success(c, 200, values)
}

func (s *Server) createTarget(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	title, description, due, e := parseTargetInput(c)
	if e != nil {
		return e
	}
	now := time.Now().UTC()
	value := model.Target{ID: primitive.NewObjectID(), UserID: c.Locals("user_id").(primitive.ObjectID), Title: title, Description: description, DueDate: due, CreatedAt: now, UpdatedAt: now, Todos: []model.Todo{}, CanEdit: true}
	if _, e = db.Collection("targets").InsertOne(c.UserContext(), value); e != nil {
		return e
	}
	return success(c, 201, value)
}

func (s *Server) updateTarget(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	title, description, due, e := parseTargetInput(c)
	if e != nil {
		return e
	}
	filter := bson.M{"_id": id, "user_id": c.Locals("user_id").(primitive.ObjectID)}
	result, e := db.Collection("targets").UpdateOne(c.UserContext(), filter, bson.M{"$set": bson.M{"title": title, "description": description, "due_date": due, "updated_at": time.Now().UTC()}})
	if e != nil {
		return e
	}
	if result.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(204)
}

func (s *Server) deleteTarget(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	result, e := db.Collection("targets").DeleteOne(c.UserContext(), bson.M{"_id": id, "user_id": uid})
	if e != nil {
		return e
	}
	if result.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	if _, e = db.Collection("todos").DeleteMany(c.UserContext(), bson.M{"target_id": id, "user_id": uid}); e != nil {
		return e
	}
	return c.SendStatus(204)
}

func (s *Server) shareTarget(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		Email string `json:"email"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	viewer, e := s.auth.Users.FindByEmail(c.UserContext(), email)
	if e != nil {
		return fiber.NewError(404, "account not found")
	}
	ownerID := c.Locals("user_id").(primitive.ObjectID)
	if viewer.ID == ownerID {
		return fiber.NewError(422, "target already belongs to this account")
	}
	result, e := db.Collection("targets").UpdateOne(c.UserContext(), bson.M{"_id": id, "user_id": ownerID}, bson.M{"$addToSet": bson.M{"shared_with": viewer.ID}, "$set": bson.M{"updated_at": time.Now().UTC()}})
	if e != nil {
		return e
	}
	if result.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return success(c, 200, fiber.Map{"shared": true})
}

func (s *Server) createTargetTodo(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	if e = db.Collection("targets").FindOne(c.UserContext(), bson.M{"_id": id, "user_id": uid}).Err(); e != nil {
		return fiber.ErrNotFound
	}
	var input struct {
		Title string `json:"title"`
		Notes string `json:"notes"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	input.Title, input.Notes = strings.TrimSpace(input.Title), strings.TrimSpace(input.Notes)
	if input.Title == "" || len(input.Title) > 160 || len(input.Notes) > 1000 {
		return fiber.NewError(422, "todo title or notes are invalid")
	}
	now := time.Now().UTC()
	value := model.Todo{ID: primitive.NewObjectID(), UserID: uid, TargetID: id, Title: input.Title, Notes: input.Notes, CreatedAt: now, UpdatedAt: now}
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

func (s *Server) checkTodo(c *fiber.Ctx) error {
	db, e := s.featureDB()
	if e != nil {
		return e
	}
	id, e := primitive.ObjectIDFromHex(c.Params("id"))
	if e != nil {
		return bad("INVALID_ID", "Invalid identifier")
	}
	var input struct {
		Completed bool `json:"completed"`
	}
	if c.BodyParser(&input) != nil {
		return bad("INVALID_REQUEST", "Invalid request")
	}
	uid := c.Locals("user_id").(primitive.ObjectID)
	var todo model.Todo
	if e = db.Collection("todos").FindOne(c.UserContext(), bson.M{"_id": id}).Decode(&todo); e != nil {
		return fiber.ErrNotFound
	}
	allowed := todo.UserID == uid
	if !todo.TargetID.IsZero() {
		allowed = db.Collection("targets").FindOne(c.UserContext(), bson.M{"_id": todo.TargetID, "$or": []bson.M{{"user_id": uid}, {"shared_with": uid}}}).Err() == nil
	}
	if !allowed {
		return fiber.ErrForbidden
	}
	after := options.FindOneAndUpdate().SetReturnDocument(options.After)
	if e = db.Collection("todos").FindOneAndUpdate(c.UserContext(), bson.M{"_id": id}, bson.M{"$set": bson.M{"completed": input.Completed, "updated_at": time.Now().UTC()}}, after).Decode(&todo); e != nil {
		return e
	}
	return success(c, 200, todo)
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
