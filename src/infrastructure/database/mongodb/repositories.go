package mongodb

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"time"
)

type Repositories struct {
	Users    *Users
	Posts    *Posts
	Versions *PostVersions
	Comments *Comments
	Sessions *Sessions
	Taxonomy *Taxonomy
	DB       *mongo.Database
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
	r := &Repositories{Users: &Users{db.Collection("users")}, Posts: &Posts{db.Collection("posts")}, Versions: &PostVersions{db.Collection("post_versions")}, Comments: &Comments{db.Collection("comments")}, Sessions: &Sessions{db.Collection("refresh_sessions")}, Taxonomy: &Taxonomy{categories: db.Collection("categories"), tags: db.Collection("tags")}, DB: db}
	if e = r.indexes(ctx); e != nil {
		return nil, nil, e
	}
	return c, r, nil
}
func (r *Repositories) indexes(ctx context.Context) error {
	spec := map[string][]mongo.IndexModel{"users": {{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)}}, "posts": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "status", Value: 1}, {Key: "published_at", Value: -1}}}, {Keys: bson.D{{Key: "author_id", Value: 1}}}}, "post_versions": {{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "number", Value: -1}}, Options: options.Index().SetUnique(true)}}, "comments": {{Keys: bson.D{{Key: "post_id", Value: 1}, {Key: "created_at", Value: 1}}}}, "categories": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}}, "tags": {{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)}}, "refresh_sessions": {{Keys: bson.D{{Key: "token_hash", Value: 1}}, Options: options.Index().SetUnique(true)}, {Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)}}}
	for n, idx := range spec {
		if _, e := r.DB.Collection(n).Indexes().CreateMany(ctx, idx); e != nil {
			return e
		}
	}
	return nil
}

type Users struct{ c *mongo.Collection }

func (r *Users) Create(ctx context.Context, v *model.User) error {
	v.ID = primitive.NewObjectID()
	_, e := r.c.InsertOne(ctx, v)
	return e
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
func (r *Users) UpdateProfile(ctx context.Context, id primitive.ObjectID, name, phone string) error {
	_, e := r.c.UpdateByID(ctx, id, bson.M{"$set": bson.M{"name": name, "phone": phone, "updated_at": time.Now().UTC()}})
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
	if f.Search != "" {
		q["$or"] = []bson.M{{"title": bson.M{"$regex": f.Search, "$options": "i"}}, {"excerpt": bson.M{"$regex": f.Search, "$options": "i"}}}
	}
	if f.Tag != "" {
		if id, err := primitive.ObjectIDFromHex(f.Tag); err == nil {
			q["tag_ids"] = id
		}
	}
	if f.Category != "" {
		if id, err := primitive.ObjectIDFromHex(f.Category); err == nil {
			q["category_ids"] = id
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
	cur, e := r.c.Find(ctx, q, options.Find().SetSort(bson.D{{Key: "published_at", Value: -1}}).SetSkip(int64((f.Page-1)*f.Limit)).SetLimit(int64(f.Limit)))
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
