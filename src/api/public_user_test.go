package api

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"lumina/src/domain/comment"
	"lumina/src/domain/model"
	"lumina/src/domain/post"
	"lumina/src/domain/recommendation"
	"lumina/src/domain/repository"
	seriesdomain "lumina/src/domain/series"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
)

type publicComments struct{ values []model.Comment }

func (f *publicComments) ListByPost(context.Context, primitive.ObjectID) ([]model.Comment, error) {
	return append([]model.Comment(nil), f.values...), nil
}
func (f *publicComments) List(context.Context) ([]model.Comment, error) {
	return append([]model.Comment(nil), f.values...), nil
}
func (f *publicComments) FindByID(_ context.Context, id primitive.ObjectID) (*model.Comment, error) {
	for index := range f.values {
		if f.values[index].ID == id {
			return &f.values[index], nil
		}
	}
	return nil, mongo.ErrNoDocuments
}
func (*publicComments) Create(context.Context, *model.Comment) error                   { return nil }
func (*publicComments) UpdateStatus(context.Context, primitive.ObjectID, string) error { return nil }
func (*publicComments) Delete(context.Context, primitive.ObjectID) error               { return nil }

type publicSeries struct {
	value model.Series
	links []model.SeriesPost
}

func (f *publicSeries) Create(context.Context, *model.Series) error      { return nil }
func (f *publicSeries) Update(context.Context, *model.Series) error      { return nil }
func (f *publicSeries) Delete(context.Context, primitive.ObjectID) error { return nil }
func (f *publicSeries) FindByID(_ context.Context, id primitive.ObjectID) (*model.Series, error) {
	if f.value.ID != id {
		return nil, mongo.ErrNoDocuments
	}
	value := f.value
	return &value, nil
}
func (f *publicSeries) FindBySlug(_ context.Context, slug string) (*model.Series, error) {
	if f.value.Slug != slug {
		return nil, mongo.ErrNoDocuments
	}
	value := f.value
	return &value, nil
}
func (f *publicSeries) List(_ context.Context, authorID primitive.ObjectID, publicOnly, featuredOnly bool) ([]model.Series, error) {
	if !authorID.IsZero() && f.value.AuthorID != authorID {
		return []model.Series{}, nil
	}
	if publicOnly && f.value.Status != "published" {
		return []model.Series{}, nil
	}
	if featuredOnly && !f.value.IsFeatured {
		return []model.Series{}, nil
	}
	return []model.Series{f.value}, nil
}
func (f *publicSeries) ReplacePosts(context.Context, primitive.ObjectID, []primitive.ObjectID) error {
	return nil
}
func (f *publicSeries) ListPosts(context.Context, primitive.ObjectID) ([]model.SeriesPost, error) {
	return append([]model.SeriesPost(nil), f.links...), nil
}
func (f *publicSeries) FindByPost(_ context.Context, postID primitive.ObjectID) (*model.SeriesPost, error) {
	for index := range f.links {
		if f.links[index].PostID == postID {
			value := f.links[index]
			return &value, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}
func (*publicSeries) RemovePost(context.Context, primitive.ObjectID, primitive.ObjectID) error {
	return nil
}

type publicFollows struct{}

func (publicFollows) Create(context.Context, *model.Follow) error { return nil }
func (publicFollows) Delete(context.Context, primitive.ObjectID, primitive.ObjectID) error {
	return nil
}
func (publicFollows) Exists(context.Context, primitive.ObjectID, primitive.ObjectID) (bool, error) {
	return false, nil
}
func (publicFollows) Count(context.Context, primitive.ObjectID) (int64, error) { return 3, nil }
func (publicFollows) ListAuthorIDs(context.Context, primitive.ObjectID) ([]primitive.ObjectID, error) {
	return nil, nil
}

func publicUserTestServer() *Server {
	authorID, postID, seriesID := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	users := &apiUsers{items: map[primitive.ObjectID]*model.User{authorID: {
		ID: authorID, Username: "ada", Name: "Ada", Avatar: "/ada.png", Bio: "Writer",
		SocialLinks: model.SocialLinks{Website: "https://example.com"}, Email: "private@example.com",
		Phone: "+84999999999", Role: "admin", PasswordHash: "never-serialize", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}}}
	posts := &apiPosts{items: map[primitive.ObjectID]*model.Post{postID: {
		ID: postID, AuthorID: authorID, Title: "Public story", Slug: "public-story", Excerpt: "Public", Content: "Text", Status: "public", CreatedAt: time.Now(),
	}}}
	comments := &publicComments{values: []model.Comment{{ID: primitive.NewObjectID(), PostID: postID, UserID: authorID, Content: "Comment", Status: "visible", CreatedAt: time.Now()}}}
	seriesRepo := &publicSeries{value: model.Series{ID: seriesID, AuthorID: authorID, Title: "Series", Slug: "series", Status: "published", IsFeatured: true}, links: []model.SeriesPost{{SeriesID: seriesID, PostID: postID, Order: 1}}}
	seriesService := seriesdomain.Service{Repo: seriesRepo, Posts: posts, Users: users}
	recommendations := &recommendation.Service{Posts: posts, Series: seriesRepo}
	auth := user.Service{Users: users, Sessions: apiSessions{}, Secret: []byte("public-user-test-secret"), AccessTTL: time.Hour, RefreshTTL: time.Hour}
	return New(config.Config{ClientOrigin: "http://localhost:5173", JWTSecret: "public-user-test-secret"}, auth, post.Service{Repo: posts}, comment.Service{Comments: comments, Posts: posts}, taxonomy.Service{Repo: apiTaxonomy{}}, seriesService, recommendations, apiStorage{}, publicFollows{})
}

func publicUserAllowedKeys() map[string]bool {
	return map[string]bool{"id": true, "username": true, "name": true, "avatar": true, "bio": true, "social_links": true}
}

// assertPublicUsersSafe checks the complete key set, so adding a newly
// serializable field to User cannot silently expose it through nested resources.
func assertPublicUsersSafe(t *testing.T, value any) {
	t.Helper()
	allowed := publicUserAllowedKeys()
	var walk func(any, string)
	walk = func(current any, key string) {
		switch typed := current.(type) {
		case map[string]any:
			if key == "author" || key == "user" {
				for field := range typed {
					if !allowed[field] {
						t.Errorf("public %s exposed disallowed user key %q", key, field)
					}
				}
			}
			for childKey, child := range typed {
				walk(child, childKey)
			}
		case []any:
			for _, child := range typed {
				walk(child, key)
			}
		}
	}
	walk(value, "")
}

func TestPublicUserDTOCoversOnlyExplicitAllowlist(t *testing.T) {
	typeOfDTO := reflect.TypeOf(model.PublicUserDTO{})
	allowed := publicUserAllowedKeys()
	for index := 0; index < typeOfDTO.NumField(); index++ {
		key := strings.Split(typeOfDTO.Field(index).Tag.Get("json"), ",")[0]
		if !allowed[key] {
			t.Fatalf("PublicUserDTO contains non-allowlisted JSON key %q", key)
		}
	}
	if typeOfDTO.NumField() != len(allowed) {
		t.Fatalf("PublicUserDTO fields=%d, allowlist=%d", typeOfDTO.NumField(), len(allowed))
	}
}

func TestEveryPublicUserResponseUsesSafeDTO(t *testing.T) {
	server := publicUserTestServer()
	paths := []string{
		"/api/posts", "/api/posts?q=Public", "/api/posts/public-story",
		"/api/posts/public-story/comments", "/api/series", "/api/series?featured=true",
		"/api/series/series", "/api/posts/public-story/series", "/api/authors/ada",
		"/api/authors/ada/follow", "/api/recommendations",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			status, response := jsonRequest(t, server, "GET", path, "", nil)
			if status != 200 {
				t.Fatalf("status=%d response=%v", status, response)
			}
			assertPublicUsersSafe(t, response)
		})
	}
}

var _ repository.CommentRepository = (*publicComments)(nil)
var _ repository.SeriesRepository = (*publicSeries)(nil)
var _ repository.FollowRepository = publicFollows{}
