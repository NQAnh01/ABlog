package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"sort"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
	"lumina/src/domain/comment"
	"lumina/src/domain/model"
	"lumina/src/domain/post"
	"lumina/src/domain/repository"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
	"lumina/src/infrastructure/storage"
)

type apiUsers struct {
	items map[primitive.ObjectID]*model.User
}

func (f *apiUsers) Create(context.Context, *model.User) error { return nil }
func (f *apiUsers) FindByEmail(context.Context, string) (*model.User, error) {
	return nil, mongo.ErrNoDocuments
}
func (f *apiUsers) FindByID(_ context.Context, id primitive.ObjectID) (*model.User, error) {
	if v, ok := f.items[id]; ok {
		return v, nil
	}
	return nil, mongo.ErrNoDocuments
}
func (f *apiUsers) UpdateProfile(_ context.Context, id primitive.ObjectID, name, phone string) error {
	if v, ok := f.items[id]; ok {
		v.Name, v.Phone = name, phone
		return nil
	}
	return mongo.ErrNoDocuments
}
func (f *apiUsers) UpdatePassword(_ context.Context, id primitive.ObjectID, hash string) error {
	if v, ok := f.items[id]; ok {
		v.PasswordHash = hash
		return nil
	}
	return mongo.ErrNoDocuments
}
func (f *apiUsers) UpdateAvatar(_ context.Context, id primitive.ObjectID, avatar string) error {
	if v, ok := f.items[id]; ok {
		v.Avatar = avatar
		return nil
	}
	return mongo.ErrNoDocuments
}

type apiSessions struct{}

func (apiSessions) Create(context.Context, *model.RefreshSession) error { return nil }
func (apiSessions) FindByHash(context.Context, string) (*model.RefreshSession, error) {
	return nil, mongo.ErrNoDocuments
}
func (apiSessions) DeleteByHash(context.Context, string) error             { return nil }
func (apiSessions) DeleteByUser(context.Context, primitive.ObjectID) error { return nil }

type apiPosts struct {
	items map[primitive.ObjectID]*model.Post
}

func (f *apiPosts) List(_ context.Context, filter repository.PostFilter) ([]model.Post, int64, error) {
	var out []model.Post
	for _, v := range f.items {
		statusMatches := filter.Status == "" || v.Status == filter.Status
		authorMatches := filter.AuthorID.IsZero() || v.AuthorID == filter.AuthorID
		if statusMatches && authorMatches {
			out = append(out, *v)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, int64(len(out)), nil
}
func (f *apiPosts) FindBySlug(_ context.Context, slug string) (*model.Post, error) {
	for _, v := range f.items {
		if v.Slug == slug {
			return v, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}
func (f *apiPosts) FindByID(_ context.Context, id primitive.ObjectID) (*model.Post, error) {
	if v, ok := f.items[id]; ok {
		return v, nil
	}
	return nil, mongo.ErrNoDocuments
}
func (f *apiPosts) Create(_ context.Context, v *model.Post) error {
	v.ID = primitive.NewObjectID()
	clone := *v
	f.items[v.ID] = &clone
	return nil
}
func (f *apiPosts) Update(_ context.Context, v *model.Post) error {
	clone := *v
	f.items[v.ID] = &clone
	return nil
}
func (f *apiPosts) Delete(_ context.Context, id primitive.ObjectID) error {
	delete(f.items, id)
	return nil
}

type apiComments struct{}

func (apiComments) ListByPost(context.Context, primitive.ObjectID) ([]model.Comment, error) {
	return nil, nil
}
func (apiComments) List(context.Context) ([]model.Comment, error) { return nil, nil }
func (apiComments) FindByID(context.Context, primitive.ObjectID) (*model.Comment, error) {
	return nil, mongo.ErrNoDocuments
}
func (apiComments) Create(context.Context, *model.Comment) error                   { return nil }
func (apiComments) UpdateStatus(context.Context, primitive.ObjectID, string) error { return nil }
func (apiComments) Delete(context.Context, primitive.ObjectID) error               { return nil }

type apiTaxonomy struct{}

func (apiTaxonomy) ListCategories(context.Context) ([]model.Category, error) {
	return []model.Category{}, nil
}
func (apiTaxonomy) FindCategoryBySlug(context.Context, string) (*model.Category, error) {
	return nil, mongo.ErrNoDocuments
}
func (apiTaxonomy) CreateCategory(_ context.Context, v *model.Category) error {
	v.ID = primitive.NewObjectID()
	return nil
}
func (apiTaxonomy) UpdateCategory(context.Context, *model.Category) error    { return nil }
func (apiTaxonomy) DeleteCategory(context.Context, primitive.ObjectID) error { return nil }
func (apiTaxonomy) ListTags(context.Context) ([]model.Tag, error)            { return []model.Tag{}, nil }
func (apiTaxonomy) FindTagBySlug(context.Context, string) (*model.Tag, error) {
	return nil, mongo.ErrNoDocuments
}
func (apiTaxonomy) CreateTag(_ context.Context, v *model.Tag) error {
	v.ID = primitive.NewObjectID()
	return nil
}
func (apiTaxonomy) UpdateTag(context.Context, *model.Tag) error         { return nil }
func (apiTaxonomy) DeleteTag(context.Context, primitive.ObjectID) error { return nil }

type apiStorage struct{}

func (apiStorage) Upload(context.Context, string, io.Reader) (storage.StoredObject, error) {
	return storage.StoredObject{Key: "posts/test.webp", URL: "/uploads/posts/test.webp"}, nil
}
func (apiStorage) Delete(context.Context, string) error { return nil }
func (apiStorage) GetURL(key string) string             { return "/uploads/" + key }

func postTestServer(t *testing.T) (*Server, string, string) {
	t.Helper()
	secret := []byte("post-api-test-secret")
	adminID, userID := primitive.NewObjectID(), primitive.NewObjectID()
	hash, err := bcrypt.GenerateFromPassword([]byte("current-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	users := &apiUsers{items: map[primitive.ObjectID]*model.User{adminID: {ID: adminID, Name: "Editor", Email: "editor@example.com", PasswordHash: string(hash), Role: "admin"}, userID: {ID: userID, Name: "Reader", Email: "reader@example.com", PasswordHash: string(hash), Role: "user"}}}
	posts := &apiPosts{items: map[primitive.ObjectID]*model.Post{}}
	auth := user.Service{Users: users, Sessions: apiSessions{}, Secret: secret, AccessTTL: time.Hour, RefreshTTL: time.Hour}
	server := New(config.Config{ClientOrigin: "http://localhost:5173", JWTSecret: string(secret)}, auth, post.Service{Repo: posts}, comment.Service{Comments: apiComments{}, Posts: posts}, taxonomy.Service{Repo: apiTaxonomy{}}, apiStorage{})
	return server, accessToken(t, secret, adminID, "admin"), accessToken(t, secret, userID, "user")
}
func accessToken(t *testing.T, secret []byte, id primitive.ObjectID, role string) string {
	t.Helper()
	value, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": id.Hex(), "role": role, "exp": time.Now().Add(time.Hour).Unix()}).SignedString(secret)
	if err != nil {
		t.Fatal(err)
	}
	return value
}
func jsonRequest(t *testing.T, server *Server, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := server.App.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var decoded map[string]any
	if res.StatusCode != 204 {
		if err = json.NewDecoder(res.Body).Decode(&decoded); err != nil {
			t.Fatal(err)
		}
	}
	return res.StatusCode, decoded
}

func TestAdminPostCreateUpdateGetAndListFlow(t *testing.T) {
	server, adminToken, userToken := postTestServer(t)
	input := map[string]any{"title": "Architecture of Calm", "excerpt": "A quiet introduction", "content": "A complete editorial story.", "status": "private", "category_ids": []string{}, "tag_ids": []string{}}
	status, _ := jsonRequest(t, server, "POST", "/api/admin/posts", userToken, input)
	if status != 403 {
		t.Fatalf("user create status=%d, want 403", status)
	}
	status, created := jsonRequest(t, server, "POST", "/api/admin/posts", adminToken, input)
	if status != 201 {
		t.Fatalf("create status=%d response=%v", status, created)
	}
	data := created["data"].(map[string]any)
	id := data["id"].(string)
	if data["slug"] != "architecture-of-calm" || data["status"] != "private" {
		t.Fatalf("unexpected created post: %v", data)
	}
	status, got := jsonRequest(t, server, "GET", "/api/admin/posts/"+id, adminToken, nil)
	if status != 200 || got["data"].(map[string]any)["title"] != "Architecture of Calm" {
		t.Fatalf("get failed: %d %v", status, got)
	}
	input["title"] = "Architecture of Deep Calm"
	input["slug"] = "architecture-deep-calm"
	input["status"] = "public"
	status, updated := jsonRequest(t, server, "PUT", "/api/admin/posts/"+id, adminToken, input)
	updatedData := updated["data"].(map[string]any)
	if status != 200 || updatedData["status"] != "public" || updatedData["published_at"] == nil {
		t.Fatalf("update failed: %d %v", status, updated)
	}
	status, list := jsonRequest(t, server, "GET", "/api/admin/posts?status=public", adminToken, nil)
	items := list["data"].(map[string]any)["items"].([]any)
	if status != 200 || len(items) != 1 {
		t.Fatalf("list failed: %d %v", status, list)
	}
}

func TestAdminPostValidationAndAuthentication(t *testing.T) {
	server, adminToken, _ := postTestServer(t)
	status, _ := jsonRequest(t, server, "GET", "/api/admin/posts", "", nil)
	if status != 401 {
		t.Fatalf("anonymous status=%d, want 401", status)
	}
	status, response := jsonRequest(t, server, "POST", "/api/admin/posts", adminToken, map[string]any{"title": "No content", "status": "private"})
	if status != 422 {
		t.Fatalf("invalid create status=%d response=%v", status, response)
	}
}

func TestAdminThumbnailUpload(t *testing.T) {
	server, adminToken, _ := postTestServer(t)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "cover.png")
	if err != nil {
		t.Fatal(err)
	}
	// PNG signature is sufficient for http.DetectContentType in this handler.
	if _, err = part.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0}); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/admin/uploads", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+adminToken)
	res, err := server.App.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 201 {
		t.Fatalf("upload status=%d, want 201", res.StatusCode)
	}
	var response map[string]any
	if err = json.NewDecoder(res.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	data := response["data"].(map[string]any)
	if data["url"] != "/uploads/posts/test.webp" {
		t.Fatalf("unexpected upload response: %v", data)
	}
}

func TestUserAvatarUpload(t *testing.T) {
	server, _, userToken := postTestServer(t)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "avatar.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0}); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/me/avatar", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+userToken)
	res, err := server.App.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("avatar upload status=%d, want 200", res.StatusCode)
	}
	var response map[string]any
	if err = json.NewDecoder(res.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if response["data"].(map[string]any)["avatar"] != "/uploads/posts/test.webp" {
		t.Fatalf("avatar was not persisted: %v", response)
	}
}

func TestUserOwnPostPermissionsAndAdminOverride(t *testing.T) {
	server, adminToken, userToken := postTestServer(t)
	input := map[string]any{"title": "A Reader Becomes a Writer", "content": "The user's own story.", "status": "private", "category_ids": []string{}, "tag_ids": []string{}}
	status, created := jsonRequest(t, server, "POST", "/api/me/posts", userToken, input)
	if status != 201 {
		t.Fatalf("user create status=%d response=%v", status, created)
	}
	owned := created["data"].(map[string]any)
	ownedID := owned["id"].(string)
	status, _ = jsonRequest(t, server, "GET", "/api/me/posts/"+ownedID, userToken, nil)
	if status != 200 {
		t.Fatalf("owner get status=%d, want 200", status)
	}
	input["title"] = "A Writer's Revised Story"
	status, _ = jsonRequest(t, server, "PUT", "/api/me/posts/"+ownedID, userToken, input)
	if status != 200 {
		t.Fatalf("owner update status=%d, want 200", status)
	}

	adminInput := map[string]any{"title": "Administrator Story", "content": "Owned by admin.", "status": "private", "category_ids": []string{}, "tag_ids": []string{}}
	_, adminCreated := jsonRequest(t, server, "POST", "/api/me/posts", adminToken, adminInput)
	adminPostID := adminCreated["data"].(map[string]any)["id"].(string)
	status, _ = jsonRequest(t, server, "PUT", "/api/me/posts/"+adminPostID, userToken, input)
	if status != 403 {
		t.Fatalf("non-owner update status=%d, want 403", status)
	}
	status, _ = jsonRequest(t, server, "DELETE", "/api/me/posts/"+adminPostID, userToken, nil)
	if status != 403 {
		t.Fatalf("non-owner delete status=%d, want 403", status)
	}

	adminOverride := map[string]any{"title": "Edited by Administrator", "content": "Admin may edit any post.", "status": "public", "category_ids": []string{}, "tag_ids": []string{}}
	status, _ = jsonRequest(t, server, "PUT", "/api/me/posts/"+ownedID, adminToken, adminOverride)
	if status != 200 {
		t.Fatalf("admin override status=%d, want 200", status)
	}
	status, list := jsonRequest(t, server, "GET", "/api/me/posts", userToken, nil)
	items := list["data"].(map[string]any)["items"].([]any)
	if status != 200 || len(items) != 1 {
		t.Fatalf("user list leaked other posts: %d %v", status, list)
	}
}

func TestAuthenticatedWriterCanCreateAndEditTaxonomy(t *testing.T) {
	server, _, userToken := postTestServer(t)
	status, _ := jsonRequest(t, server, "POST", "/api/me/categories", "", map[string]any{"name": "Essays"})
	if status != 401 {
		t.Fatalf("anonymous taxonomy status=%d, want 401", status)
	}
	status, category := jsonRequest(t, server, "POST", "/api/me/categories", userToken, map[string]any{"name": "Long Form", "description": "Long-form writing"})
	if status != 201 {
		t.Fatalf("create category status=%d response=%v", status, category)
	}
	categoryData := category["data"].(map[string]any)
	if categoryData["slug"] != "long-form" {
		t.Fatalf("category slug was not generated: %v", categoryData)
	}
	categoryID := categoryData["id"].(string)
	status, _ = jsonRequest(t, server, "PUT", "/api/me/categories/"+categoryID, userToken, map[string]any{"name": "Deep Essays", "slug": "deep-essays"})
	if status != 200 {
		t.Fatalf("update category status=%d", status)
	}
	status, tag := jsonRequest(t, server, "POST", "/api/me/tags", userToken, map[string]any{"name": "Creative Code"})
	if status != 201 || tag["data"].(map[string]any)["slug"] != "creative-code" {
		t.Fatalf("create tag failed: %d %v", status, tag)
	}
}

func TestProfileAndPasswordAPI(t *testing.T) {
	server, _, userToken := postTestServer(t)
	status, profile := jsonRequest(t, server, "PUT", "/api/me/profile", userToken, map[string]any{"name": "New Reader Name", "phone": "+84 901 234 567"})
	if status != 200 {
		t.Fatalf("profile update status=%d response=%v", status, profile)
	}
	data := profile["data"].(map[string]any)
	if data["name"] != "New Reader Name" || data["phone"] != "+84 901 234 567" {
		t.Fatalf("unexpected profile response: %v", data)
	}
	status, _ = jsonRequest(t, server, "PUT", "/api/me/profile", userToken, map[string]any{"name": "New Reader Name", "phone": "invalid-phone"})
	if status != 422 {
		t.Fatalf("invalid phone status=%d, want 422", status)
	}
	status, _ = jsonRequest(t, server, "PUT", "/api/me/password", userToken, map[string]any{"current_password": "wrong-password", "new_password": "another-password", "confirm_password": "another-password"})
	if status != 422 {
		t.Fatalf("wrong current password status=%d, want 422", status)
	}
	status, _ = jsonRequest(t, server, "PUT", "/api/me/password", userToken, map[string]any{"current_password": "current-password", "new_password": "another-password", "confirm_password": "another-password"})
	if status != 204 {
		t.Fatalf("password update status=%d, want 204", status)
	}
}
