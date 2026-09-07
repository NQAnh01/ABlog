package mongodb

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"strings"
	"time"
)

type Repositories struct {
	Users          *Users
	Posts          *Posts
	Versions       *PostVersions
	Comments       *Comments
	Sessions       *Sessions
	Taxonomy       *Taxonomy
	Bookmarks      *Bookmarks
	Follows        *Follows
	PasswordResets *PasswordResets
	Series         *Series
	DB             *mongo.Database
}

func New(ctx context.Context, uri, name string) (*mongo.Client, *Repositories, error) {
	c, e := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if e != nil {
		return nil, nil, e
	}
	if e = c.Ping(ctx, nil); e != nil {
		return nil, nil, e
	}
	db := c.Database(name)
	r := &Repositories{Users: &Users{db.Collection("users")}, Posts: &Posts{db.Collection("posts")}, Versions: &PostVersions{db.Collection("post_versions")}, Comments: &Comments{db.Collection("comments")}, Sessions: &Sessions{db.Collection("refresh_sessions")}, Taxonomy: &Taxonomy{categories: db.Collection("categories"), tags: db.Collection("tags")}, Bookmarks: &Bookmarks{db.Collection("bookmarks")}, Follows: &Follows{db.Collection("follows")}, PasswordResets: &PasswordResets{db.Collection("password_resets")}, Series: &Series{series: db.Collection("series"), posts: db.Collection("series_posts")}, DB: db}
	if e = migrateAuthorUsernames(ctx, db.Collection("users")); e != nil {
		return nil, nil, e
	}
	if e = r.indexes(ctx); e != nil {
		return nil, nil, e
	}
	return c, r, nil
}
func (r *Repositories) indexes(ctx context.Context) error {
	spec := map[string][]mongo.IndexModel{"users": {{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)}}, "posts": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "status", Value: 1}, {Key: "published_at", Value: -1}}}, {Keys: bson.D{{Key: "author_id", Value: 1}, {Key: "published_at", Value: -1}}}, {Keys: bson.D{{Key: "tag_ids", Value: 1}, {Key: "status", Value: 1}, {Key: "published_at", Value: -1}}}, {Keys: bson.D{{Key: "category_ids", Value: 1}, {Key: "status", Value: 1}, {Key: "published_at", Value: -1}}}}, "post_versions": {{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "number", Value: -1}}, Options: options.Index().SetUnique(true)}}, "comments": {{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "created_at", Value: 1}}}}, "categories": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}}, "tags": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}}, "refresh_sessions": {{Keys: bson.D{{Key: "token_hash", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)}}, "bookmarks": {{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "post_id", Value: 1}}, Options: options.Index().SetUnique(true)}}, "follows": {{Keys: bson.D{{Key: "follower_id", Value: 1}, {Key: "author_id", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "author_id", Value: 1}}}}, "password_resets": {{Keys: bson.D{{Key: "token_hash", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)}}}
	for n, idx := range spec {
		if _, e := r.DB.Collection(n).Indexes().CreateMany(ctx, idx); e != nil {
			return e
		}
	}
	if _, e := r.DB.Collection("series").Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}); e != nil {
		return e
	}
	if _, e := r.DB.Collection("series_posts").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "post_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "series_id", Value: 1}, {Key: "order", Value: 1}}, Options: options.Index().SetUnique(true)},
	}); e != nil {
		return e
	}
	if _, e := r.DB.Collection("todos").Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}}, {Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "target_id", Value: 1}, {Key: "created_at", Value: 1}}}}); e != nil {
		return e
	}
	if _, e := r.DB.Collection("targets").Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "due_date", Value: 1}}}, {Keys: bson.D{{Key: "shared_with", Value: 1}, {Key: "due_date", Value: 1}}}}); e != nil {
		return e
	}
	if _, e := r.DB.Collection("discussions").Indexes().CreateMany(ctx, []mongo.IndexModel{{Keys: bson.D{{Key: "created_at", Value: -1}}}, {Keys: bson.D{{Key: "interested_ids", Value: 1}}}}); e != nil {
		return e
	}
	return nil
}

type Users struct{ c *mongo.Collection }

func migrateAuthorUsernames(ctx context.Context, users *mongo.Collection) error {
	cursor, err := users.Find(ctx, bson.M{"$or": []bson.M{{"username": bson.M{"$exists": false}}, {"username": ""}}}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var value struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err = cursor.Decode(&value); err != nil {
			return err
		}
		if _, err = users.UpdateByID(ctx, value.ID, bson.M{"$set": bson.M{"username": "author-" + value.ID.Hex()}}); err != nil {
			return err
		}
	}
	return cursor.Err()
}

func (r *Users) Create(ctx context.Context, v *model.User) error {
	if v.ID.IsZero() {
		v.ID = primitive.NewObjectID()
	}
	if v.Username == "" {
		v.Username = "author-" + v.ID.Hex()
	}
	_, e := r.c.InsertOne(ctx, v)
	return e
}
func (r *Users) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	var value model.User
	err := r.c.FindOne(ctx, bson.M{"username": username}).Decode(&value)
	return &value, err
}
func (r *Users) UpdateAuthorProfile(ctx context.Context, id primitive.ObjectID, bio string, social model.SocialLinks) error {
	_, err := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"bio": bio, "social_links": social, "updated_at": time.Now().UTC()}})
	return err
}
func (r *Users) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	var v model.User
	e := r.c.FindOne(ctx, bson.M{"email": email}).Decode(&v)
	return &v, e
}
func (r *Users) FindByID(ctx context.Context, id primitive.ObjectID) (*model.User, error) {
	var v model.User
	e := r.c.FindOne(ctx, bson.M{"_id": id}).Decode(&v)
	return &v, e
}
func (r *Users) FindByIDs(ctx context.Context, ids []primitive.ObjectID) ([]model.User, error) {
	if len(ids) == 0 {
		return []model.User{}, nil
	}
	cursor, err := r.c.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var values []model.User
	err = cursor.All(ctx, &values)
	return values, err
}
func (r *Users) UpdateProfile(ctx context.Context, id primitive.ObjectID, name, phone string, interests []primitive.ObjectID) error {
	_, e := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"name": name, "phone": phone, "interest_category_ids": interests, "updated_at": time.Now().UTC()}})
	return e
}
func (r *Users) UpdatePassword(ctx context.Context, id primitive.ObjectID, hash string) error {
	_, e := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"password_hash": hash, "updated_at": time.Now().UTC()}})
	return e
}
func (r *Users) UpdateAvatar(ctx context.Context, id primitive.ObjectID, avatar string) error {
	_, e := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"avatar": avatar, "updated_at": time.Now().UTC()}})
	return e
}

type Posts struct{ c *mongo.Collection }

func (r *Posts) FindPublicByIDs(ctx context.Context, ids []primitive.ObjectID) ([]model.Post, error) {
	if len(ids) == 0 {
		return []model.Post{}, nil
	}
	cur, err := r.c.Find(ctx, bson.M{"_id": bson.M{"$in": ids}, "status": bson.M{"$in": []string{"public", "published"}}})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var posts []model.Post
	err = cur.All(ctx, &posts)
	for i := range posts {
		if posts[i].Status == "published" {
			posts[i].Status = "public"
		}
	}
	return posts, err
}

func (r *Posts) List(ctx context.Context, f repository.PostFilter) ([]model.Post, int64, error) {
	q := bson.M{}
	if f.Status != "" {
		switch f.Status {
		case "public":
			q["status"] = bson.M{"$in": []string{"public", "published"}}
		case "private":
			q["status"] = bson.M{"$in": []string{"private", "draft"}}
		default:
			q["status"] = f.Status
		}
	}
	if !f.AuthorID.IsZero() {
		q["author_id"] = f.AuthorID
	}
	if f.FeaturedOnly {
		q["is_featured"] = true
	}
	if f.Search != "" {
		q["$or"] = []bson.M{{"title": bson.M{"$regex": f.Search, "$options": "i"}}, {"excerpt": bson.M{"$regex": f.Search, "$options": "i"}}}
	}
	if f.Tag != "" {
		if id, err := primitive.ObjectIDFromHex(f.Tag); err == nil {
			q["tag_ids"] = id
		}
	}
	if f.Category != "" {
		ids := []primitive.ObjectID{}
		for _, raw := range strings.Split(f.Category, ",") {
			if id, err := primitive.ObjectIDFromHex(strings.TrimSpace(raw)); err == nil {
				ids = append(ids, id)
			}
		}
		if len(ids) == 1 {
			q["category_ids"] = ids[0]
		} else if len(ids) > 1 {
			q["category_ids"] = bson.M{"$in": ids}
		}
	}
	if !f.DateFrom.IsZero() || !f.DateTo.IsZero() {
		rangeQuery := bson.M{}
		if !f.DateFrom.IsZero() {
			rangeQuery["$gte"] = f.DateFrom
		}
		if !f.DateTo.IsZero() {
			rangeQuery["$lte"] = f.DateTo
		}
		q["published_at"] = rangeQuery
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	total, e := r.c.CountDocuments(ctx, q)
	if e != nil {
		return nil, 0, e
	}
	cur, e := r.c.Find(ctx, q, options.Find().SetProjection(bson.M{"content": 0, "autosave": 0}).SetSort(bson.D{{Key: "published_at", Value: -1}}).SetSkip(int64((f.Page-1)*f.Limit)).SetLimit(int64(f.Limit)))
	if e != nil {
		return nil, 0, e
	}
	defer cur.Close(ctx)
	var v []model.Post
	e = cur.All(ctx, &v)
	for i := range v {
		if v[i].Status == "published" {
			v[i].Status = "public"
		} else if v[i].Status == "draft" {
			v[i].Status = "private"
		}
	}
	return v, total, e
}
func (r *Posts) FindBySlug(ctx context.Context, s string) (*model.Post, error) {
	var v model.Post
	e := r.c.FindOne(ctx, bson.M{"slug": s}).Decode(&v)
	if v.Status == "published" {
		v.Status = "public"
	} else if v.Status == "draft" {
		v.Status = "private"
	}
	return &v, e
}
func (r *Posts) FindByID(ctx context.Context, id primitive.ObjectID) (*model.Post, error) {
	var v model.Post
	e := r.c.FindOne(ctx, bson.M{"_id": id}).Decode(&v)
	if v.Status == "published" {
		v.Status = "public"
	} else if v.Status == "draft" {
		v.Status = "private"
	}
	return &v, e
}
func (r *Posts) GetDraft(ctx context.Context, id primitive.ObjectID) (*model.PostDraft, error) {
	var value struct {
		Draft *model.PostDraft `bson:"autosave"`
	}
	err := r.c.FindOne(ctx, bson.M{"_id": id}, options.FindOne().SetProjection(bson.M{"autosave": 1})).Decode(&value)
	if err != nil {
		return nil, err
	}
	if value.Draft == nil {
		return nil, mongo.ErrNoDocuments
	}
	return value.Draft, nil
}
func (r *Posts) SaveDraft(ctx context.Context, id primitive.ObjectID, draft *model.PostDraft) (bool, error) {
	result, err := r.c.UpdateOne(ctx, bson.M{"_id": id, "$or": []bson.M{{"autosave": bson.M{"$exists": false}}, {"autosave.sequence": bson.M{"$lt": draft.Sequence}}}}, bson.M{"$set": bson.M{"autosave": draft}})
	return result != nil && result.ModifiedCount == 1, err
}
func (r *Posts) DeleteDraft(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.c.UpdateByID(ctx, id, bson.M{"$unset": bson.M{"autosave": ""}})
	return err
}
func (r *Posts) Create(ctx context.Context, v *model.Post) error {
	v.ID = primitive.NewObjectID()
	_, e := r.c.InsertOne(ctx, v)
	return e
}
func (r *Posts) Update(ctx context.Context, v *model.Post) error {
	_, e := r.c.ReplaceOne(ctx, bson.M{"_id": v.ID}, v)
	return e
}
func (r *Posts) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, e := r.c.DeleteOne(ctx, bson.M{"_id": id})
	return e
}
func reactionPipeline(userID primitive.ObjectID, reactionType string) mongo.Pipeline {
	matching := bson.M{"$filter": bson.M{"input": "$$existing", "as": "reaction", "cond": bson.M{"$eq": bson.A{"$$reaction.user_id", userID}}}}
	filtered := bson.M{"$filter": bson.M{"input": "$$existing", "as": "reaction", "cond": bson.M{"$ne": bson.A{"$$reaction.user_id", userID}}}}
	toggled := bson.M{"$let": bson.M{
		"vars": bson.M{"current": bson.M{"$arrayElemAt": bson.A{matching, 0}}, "filtered": filtered},
		"in": bson.M{"$cond": bson.A{
			bson.M{"$eq": bson.A{"$$current.type", reactionType}},
			"$$filtered",
			bson.M{"$concatArrays": bson.A{"$$filtered", bson.A{model.Reaction{UserID: userID, Type: reactionType}}}},
		}},
	}}
	value := bson.M{"$let": bson.M{"vars": bson.M{"existing": bson.M{"$ifNull": bson.A{"$reactions", bson.A{}}}}, "in": toggled}}
	return mongo.Pipeline{bson.D{{Key: "$set", Value: bson.M{"reactions": value}}}}
}
func (r *Posts) TogglePostReaction(ctx context.Context, id, userID primitive.ObjectID, reactionType string) (*model.Post, error) {
	var value model.Post
	err := r.c.FindOneAndUpdate(ctx, bson.M{"_id": id}, reactionPipeline(userID, reactionType), options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&value)
	return &value, err
}

type PostVersions struct{ c *mongo.Collection }

func (r *PostVersions) Create(ctx context.Context, postID primitive.ObjectID, snapshot *model.Post) error {
	count, err := r.c.CountDocuments(ctx, bson.M{"post_id": postID})
	if err != nil {
		return err
	}
	version := model.PostVersion{ID: primitive.NewObjectID(), PostID: postID, Number: int(count) + 1, Snapshot: *snapshot, CreatedAt: time.Now().UTC()}
	_, err = r.c.InsertOne(ctx, version)
	return err
}
func (r *PostVersions) List(ctx context.Context, postID primitive.ObjectID) ([]model.PostVersion, error) {
	cur, err := r.c.Find(ctx, bson.M{"post_id": postID}, options.Find().SetSort(bson.D{{Key: "number", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var versions []model.PostVersion
	err = cur.All(ctx, &versions)
	return versions, err
}

type Comments struct{ c *mongo.Collection }

func (r *Comments) ListByPost(ctx context.Context, id primitive.ObjectID) ([]model.Comment, error) {
	cur, e := r.c.Find(ctx, bson.M{"post_id": id, "status": "approved"}, options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}}))
	if e != nil {
		return nil, e
	}
	defer cur.Close(ctx)
	var v []model.Comment
	e = cur.All(ctx, &v)
	return v, e
}
func (r *Comments) List(ctx context.Context) ([]model.Comment, error) {
	cur, e := r.c.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if e != nil {
		return nil, e
	}
	defer cur.Close(ctx)
	var v []model.Comment
	e = cur.All(ctx, &v)
	return v, e
}
func (r *Comments) FindByID(ctx context.Context, id primitive.ObjectID) (*model.Comment, error) {
	var v model.Comment
	e := r.c.FindOne(ctx, bson.M{"_id": id}).Decode(&v)
	return &v, e
}
func (r *Comments) Create(ctx context.Context, v *model.Comment) error {
	v.ID = primitive.NewObjectID()
	_, e := r.c.InsertOne(ctx, v)
	return e
}
func (r *Comments) UpdateStatus(ctx context.Context, id primitive.ObjectID, s string) error {
	_, e := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"status": s, "updated_at": time.Now().UTC()}})
	return e
}
func (r *Comments) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, e := r.c.DeleteOne(ctx, bson.M{"_id": id})
	return e
}
func (r *Comments) ToggleCommentReaction(ctx context.Context, id, userID primitive.ObjectID, reactionType string) (*model.Comment, error) {
	var value model.Comment
	err := r.c.FindOneAndUpdate(ctx, bson.M{"_id": id}, reactionPipeline(userID, reactionType), options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&value)
	return &value, err
}
func (r *Comments) PinComment(ctx context.Context, postID, commentID primitive.ObjectID, pinned bool) error {
	if _, err := r.c.UpdateMany(ctx, bson.M{"post_id": postID, "is_pinned": true}, bson.M{"$set": bson.M{"is_pinned": false}}); err != nil {
		return err
	}
	if pinned {
		_, err := r.c.UpdateOne(ctx, bson.M{"_id": commentID, "post_id": postID}, bson.M{"$set": bson.M{"is_pinned": true}})
		return err
	}
	return nil
}

type Sessions struct{ c *mongo.Collection }

func (r *Sessions) Create(ctx context.Context, v *model.RefreshSession) error {
	v.ID = primitive.NewObjectID()
	_, e := r.c.InsertOne(ctx, v)
	return e
}
func (r *Sessions) FindByHash(ctx context.Context, h string) (*model.RefreshSession, error) {
	var v model.RefreshSession
	e := r.c.FindOne(ctx, bson.M{"token_hash": h, "expires_at": bson.M{"$gt": time.Now().UTC()}}).Decode(&v)
	return &v, e
}
func (r *Sessions) DeleteByHash(ctx context.Context, h string) error {
	_, e := r.c.DeleteOne(ctx, bson.M{"token_hash": h})
	return e
}
func (r *Sessions) DeleteByUser(ctx context.Context, id primitive.ObjectID) error {
	_, e := r.c.DeleteMany(ctx, bson.M{"user_id": id})
	return e
}

type Series struct{ series, posts *mongo.Collection }

func (r *Series) Create(ctx context.Context, value *model.Series) error {
	if value.ID.IsZero() {
		value.ID = primitive.NewObjectID()
	}
	_, err := r.series.InsertOne(ctx, value)
	return err
}
func (r *Series) Update(ctx context.Context, value *model.Series) error {
	_, err := r.series.ReplaceOne(ctx, bson.M{"_id": value.ID}, value)
	return err
}
func (r *Series) Delete(ctx context.Context, id primitive.ObjectID) error {
	if _, err := r.series.DeleteOne(ctx, bson.M{"_id": id}); err != nil {
		return err
	}
	_, err := r.posts.DeleteMany(ctx, bson.M{"series_id": id})
	return err
}
func (r *Series) FindByID(ctx context.Context, id primitive.ObjectID) (*model.Series, error) {
	var value model.Series
	err := r.series.FindOne(ctx, bson.M{"_id": id}).Decode(&value)
	return &value, err
}
func (r *Series) FindBySlug(ctx context.Context, slug string) (*model.Series, error) {
	var value model.Series
	err := r.series.FindOne(ctx, bson.M{"slug": slug}).Decode(&value)
	return &value, err
}
func (r *Series) List(ctx context.Context, authorID primitive.ObjectID, publicOnly, featuredOnly bool) ([]model.Series, error) {
	query := bson.M{}
	if !authorID.IsZero() {
		query["author_id"] = authorID
	}
	if publicOnly {
		query["status"] = "published"
	}
	if featuredOnly {
		query["is_featured"] = true
	}
	cursor, err := r.series.Find(ctx, query, options.Find().SetSort(bson.D{{Key: "updated_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var values []model.Series
	err = cursor.All(ctx, &values)
	return values, err
}
func (r *Series) ReplacePosts(ctx context.Context, seriesID primitive.ObjectID, postIDs []primitive.ObjectID) error {
	if _, err := r.posts.DeleteMany(ctx, bson.M{"series_id": seriesID}); err != nil {
		return err
	}
	if len(postIDs) == 0 {
		return nil
	}
	if _, err := r.posts.DeleteMany(ctx, bson.M{"post_id": bson.M{"$in": postIDs}}); err != nil {
		return err
	}
	values := make([]interface{}, len(postIDs))
	for index, postID := range postIDs {
		values[index] = model.SeriesPost{ID: primitive.NewObjectID(), SeriesID: seriesID, PostID: postID, Order: index + 1}
	}
	_, err := r.posts.InsertMany(ctx, values)
	return err
}
func (r *Series) ListPosts(ctx context.Context, seriesID primitive.ObjectID) ([]model.SeriesPost, error) {
	cursor, err := r.posts.Find(ctx, bson.M{"series_id": seriesID}, options.Find().SetSort(bson.D{{Key: "order", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var values []model.SeriesPost
	err = cursor.All(ctx, &values)
	return values, err
}
func (r *Series) FindByPost(ctx context.Context, postID primitive.ObjectID) (*model.SeriesPost, error) {
	var value model.SeriesPost
	err := r.posts.FindOne(ctx, bson.M{"post_id": postID}).Decode(&value)
	return &value, err
}
func (r *Series) RemovePost(ctx context.Context, seriesID, postID primitive.ObjectID) error {
	_, err := r.posts.DeleteOne(ctx, bson.M{"series_id": seriesID, "post_id": postID})
	return err
}

type Bookmarks struct{ c *mongo.Collection }

func (r *Bookmarks) ListPostIDs(ctx context.Context, userID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cur, err := r.c.Find(ctx, bson.M{"user_id": userID}, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	var rows []model.Bookmark
	if err = cur.All(ctx, &rows); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.PostID)
	}
	return ids, nil
}
func (r *Bookmarks) Create(ctx context.Context, v *model.Bookmark) error {
	v.ID = primitive.NewObjectID()
	_, err := r.c.UpdateOne(ctx, bson.M{"user_id": v.UserID, "post_id": v.PostID}, bson.M{"$setOnInsert": v}, options.Update().SetUpsert(true))
	return err
}
func (r *Bookmarks) Delete(ctx context.Context, userID, postID primitive.ObjectID) error {
	_, err := r.c.DeleteOne(ctx, bson.M{"user_id": userID, "post_id": postID})
	return err
}

type Follows struct{ c *mongo.Collection }

func (r *Follows) Create(ctx context.Context, value *model.Follow) error {
	value.ID = primitive.NewObjectID()
	value.CreatedAt = time.Now().UTC()
	_, err := r.c.UpdateOne(ctx, bson.M{"follower_id": value.FollowerID, "author_id": value.AuthorID}, bson.M{"$setOnInsert": value}, options.Update().SetUpsert(true))
	return err
}
func (r *Follows) Delete(ctx context.Context, followerID, authorID primitive.ObjectID) error {
	_, err := r.c.DeleteOne(ctx, bson.M{"follower_id": followerID, "author_id": authorID})
	return err
}
func (r *Follows) Exists(ctx context.Context, followerID, authorID primitive.ObjectID) (bool, error) {
	count, err := r.c.CountDocuments(ctx, bson.M{"follower_id": followerID, "author_id": authorID}, options.Count().SetLimit(1))
	return count > 0, err
}
func (r *Follows) Count(ctx context.Context, authorID primitive.ObjectID) (int64, error) {
	return r.c.CountDocuments(ctx, bson.M{"author_id": authorID})
}
func (r *Follows) ListAuthorIDs(ctx context.Context, followerID primitive.ObjectID) ([]primitive.ObjectID, error) {
	cursor, err := r.c.Find(ctx, bson.M{"follower_id": followerID}, options.Find().SetProjection(bson.M{"author_id": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []model.Follow
	if err = cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	ids := make([]primitive.ObjectID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.AuthorID)
	}
	return ids, nil
}

type PasswordResets struct{ c *mongo.Collection }

func (r *PasswordResets) Create(ctx context.Context, v *model.PasswordReset) error {
	v.ID = primitive.NewObjectID()
	_, err := r.c.InsertOne(ctx, v)
	return err
}
func (r *PasswordResets) FindByHash(ctx context.Context, hash string) (*model.PasswordReset, error) {
	var v model.PasswordReset
	err := r.c.FindOne(ctx, bson.M{"token_hash": hash, "expires_at": bson.M{"$gt": time.Now().UTC()}}).Decode(&v)
	return &v, err
}
func (r *PasswordResets) DeleteByHash(ctx context.Context, hash string) error {
	_, err := r.c.DeleteOne(ctx, bson.M{"token_hash": hash})
	return err
}
func (r *PasswordResets) DeleteByUser(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.c.DeleteMany(ctx, bson.M{"user_id": id})
	return err
}

type Taxonomy struct{ categories, tags *mongo.Collection }

func (r *Taxonomy) ListCategories(ctx context.Context) ([]model.Category, error) {
	cur, e := r.categories.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if e != nil {
		return nil, e
	}
	defer cur.Close(ctx)
	var v []model.Category
	e = cur.All(ctx, &v)
	return v, e
}
func (r *Taxonomy) FindCategoryBySlug(ctx context.Context, s string) (*model.Category, error) {
	var v model.Category
	e := r.categories.FindOne(ctx, bson.M{"slug": s}).Decode(&v)
	return &v, e
}
func (r *Taxonomy) CreateCategory(ctx context.Context, v *model.Category) error {
	v.ID = primitive.NewObjectID()
	_, e := r.categories.InsertOne(ctx, v)
	return e
}
func (r *Taxonomy) UpdateCategory(ctx context.Context, v *model.Category) error {
	_, e := r.categories.UpdateByID(ctx, v.ID, bson.M{"$set": bson.M{"name": v.Name, "slug": v.Slug, "description": v.Description, "updated_at": v.UpdatedAt}})
	return e
}
func (r *Taxonomy) DeleteCategory(ctx context.Context, id primitive.ObjectID) error {
	_, e := r.categories.DeleteOne(ctx, bson.M{"_id": id})
	return e
}
func (r *Taxonomy) ListTags(ctx context.Context) ([]model.Tag, error) {
	cur, e := r.tags.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if e != nil {
		return nil, e
	}
	defer cur.Close(ctx)
	var v []model.Tag
	e = cur.All(ctx, &v)
	return v, e
}
func (r *Taxonomy) FindTagBySlug(ctx context.Context, s string) (*model.Tag, error) {
	var v model.Tag
	e := r.tags.FindOne(ctx, bson.M{"slug": s}).Decode(&v)
	return &v, e
}
func (r *Taxonomy) CreateTag(ctx context.Context, v *model.Tag) error {
	v.ID = primitive.NewObjectID()
	_, e := r.tags.InsertOne(ctx, v)
	return e
}
func (r *Taxonomy) UpdateTag(ctx context.Context, v *model.Tag) error {
	_, e := r.tags.UpdateByID(ctx, v.ID, bson.M{"$set": bson.M{"name": v.Name, "slug": v.Slug, "updated_at": v.UpdatedAt}})
	return e
}
func (r *Taxonomy) DeleteTag(ctx context.Context, id primitive.ObjectID) error {
	_, e := r.tags.DeleteOne(ctx, bson.M{"_id": id})
	return e
}
