package api

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
	"lumina/src/domain/comment"
	"lumina/src/domain/model"
	"lumina/src/domain/post"
	seriesdomain "lumina/src/domain/series"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
)

func phase1TestServer(t *testing.T) (*Server, string, string, string) {
	t.Helper()
	secret := []byte("phase1-test-secret")
	adminID, editorID, userID := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	hash, _ := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.MinCost)

	users := &apiUsers{
		items: map[primitive.ObjectID]*model.User{
			adminID:  {ID: adminID, Name: "Admin User", Email: "admin@example.com", PasswordHash: string(hash), Role: "admin"},
			editorID: {ID: editorID, Name: "Editor User", Email: "editor@example.com", PasswordHash: string(hash), Role: "editor"},
			userID:   {ID: userID, Name: "Regular User", Email: "user@example.com", PasswordHash: string(hash), Role: "user"},
		},
	}
	posts := &apiPosts{items: map[primitive.ObjectID]*model.Post{}}
	auth := user.Service{Users: users, Sessions: apiSessions{}, Secret: secret, AccessTTL: time.Hour, RefreshTTL: time.Hour}
	server := New(config.Config{ClientOrigin: "http://localhost:5173", JWTSecret: string(secret)}, auth, post.Service{Repo: posts}, comment.Service{Comments: apiComments{}, Posts: posts}, taxonomy.Service{Repo: apiTaxonomy{}}, seriesdomain.Service{}, nil, apiStorage{}, nil, &apiBookmarks{items: map[primitive.ObjectID]map[primitive.ObjectID]bool{}})

	return server, accessToken(t, secret, adminID, "admin"), accessToken(t, secret, editorID, "editor"), accessToken(t, secret, userID, "user")
}

func TestBulkPostsOperations(t *testing.T) {
	server, adminToken, _, userToken := phase1TestServer(t)

	// User creates two private posts
	status, res1 := jsonRequest(t, server, "POST", "/api/me/posts", userToken, map[string]any{
		"title": "Post 1", "content": "Content 1", "status": "private", "category_ids": []string{}, "tag_ids": []string{},
	})
	if status != 201 {
		t.Fatalf("create post 1 failed: status=%d", status)
	}
	id1 := res1["data"].(map[string]any)["id"].(string)

	status, res2 := jsonRequest(t, server, "POST", "/api/me/posts", userToken, map[string]any{
		"title": "Post 2", "content": "Content 2", "status": "private", "category_ids": []string{}, "tag_ids": []string{},
	})
	if status != 201 {
		t.Fatalf("create post 2 failed: status=%d", status)
	}
	id2 := res2["data"].(map[string]any)["id"].(string)

	// User bulk publishes them
	status, bulkRes := jsonRequest(t, server, "POST", "/api/me/posts/bulk", userToken, map[string]any{
		"action": "publish",
		"ids":    []string{id1, id2},
	})
	if status != 200 {
		t.Fatalf("bulk publish failed: status=%d, res=%v", status, bulkRes)
	}
	affected := int(bulkRes["data"].(map[string]any)["affected"].(float64))
	if affected != 2 {
		t.Fatalf("expected 2 affected, got %d", affected)
	}

	// User bulk unpublishes them
	status, bulkRes = jsonRequest(t, server, "POST", "/api/me/posts/bulk", userToken, map[string]any{
		"action": "unpublish",
		"ids":    []string{id1, id2},
	})
	if status != 200 {
		t.Fatalf("bulk unpublish failed: status=%d", status)
	}

	// Admin bulk deletes them
	status, bulkRes = jsonRequest(t, server, "POST", "/api/admin/posts/bulk", adminToken, map[string]any{
		"action": "delete",
		"ids":    []string{id1, id2},
	})
	if status != 200 {
		t.Fatalf("bulk delete failed: status=%d", status)
	}
	affected = int(bulkRes["data"].(map[string]any)["affected"].(float64))
	if affected != 2 {
		t.Fatalf("expected 2 deleted, got %d", affected)
	}
}

func TestEditorRolePermissions(t *testing.T) {
	server, _, editorToken, _ := phase1TestServer(t)

	// Editor CAN access /api/admin/dashboard
	status, _ := jsonRequest(t, server, "GET", "/api/admin/dashboard", editorToken, nil)
	if status != 200 {
		t.Fatalf("editor should access admin dashboard, got %d", status)
	}

	// Editor CAN access /api/admin/comments
	status, _ = jsonRequest(t, server, "GET", "/api/admin/comments", editorToken, nil)
	if status != 200 {
		t.Fatalf("editor should access admin comments, got %d", status)
	}

	// Editor CANNOT access /api/admin/users (admin-only)
	status, _ = jsonRequest(t, server, "GET", "/api/admin/users", editorToken, nil)
	if status != 403 {
		t.Fatalf("editor must NOT access admin users, expected 403, got %d", status)
	}
}

func TestHealthAndMetricsEndpoints(t *testing.T) {
	server, _, _, _ := phase1TestServer(t)

	// Health check
	req := httptest.NewRequest("GET", "/api/healthz", nil)
	resp, err := server.App.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("healthcheck status=%d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var health map[string]any
	if err := json.Unmarshal(body, &health); err != nil {
		t.Fatalf("healthcheck json error: %v", err)
	}
	if health["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", health["status"])
	}

	// Metrics
	req = httptest.NewRequest("GET", "/api/metrics", nil)
	resp, err = server.App.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("metrics status=%d", resp.StatusCode)
	}
	metricBytes, _ := io.ReadAll(resp.Body)
	metricsText := string(metricBytes)
	if !strings.Contains(metricsText, "lumina_uptime_seconds") || !strings.Contains(metricsText, "lumina_goroutines") {
		t.Fatalf("missing expected metrics in output:\n%s", metricsText)
	}
}

func TestFeaturesEndpoint(t *testing.T) {
	server, _, _, _ := phase1TestServer(t)

	status, res := jsonRequest(t, server, "GET", "/api/features", "", nil)
	if status != 200 {
		t.Fatalf("features status=%d", status)
	}
	data := res["data"].(map[string]any)
	if data["newsletter"] != true || data["discussions"] != true {
		t.Fatalf("unexpected feature flags default: %v", data)
	}
}
