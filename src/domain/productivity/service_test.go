package productivity

import (
	"strings"
	"testing"
)

func TestTodo(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		notes   string
		wantErr bool
	}{
		{"valid", "Buy milk", "From the store", false},
		{"empty title", "", "", true},
		{"whitespace title", "   ", "", true},
		{"title at limit", strings.Repeat("a", 160), "", false},
		{"title over limit", strings.Repeat("a", 161), "", true},
		{"notes at limit", "Valid title", strings.Repeat("n", 1000), false},
		{"notes over limit", "Valid title", strings.Repeat("n", 1001), true},
		{"trims whitespace", "  Buy milk  ", "  notes  ", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			title, notes, err := Todo(tt.title, tt.notes)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Todo() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil {
				if title != strings.TrimSpace(tt.title) {
					t.Errorf("expected trimmed title %q, got %q", strings.TrimSpace(tt.title), title)
				}
				if notes != strings.TrimSpace(tt.notes) {
					t.Errorf("expected trimmed notes %q, got %q", strings.TrimSpace(tt.notes), notes)
				}
			}
		})
	}
}

func TestTarget(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		desc    string
		due     string
		wantErr bool
	}{
		{"valid", "Ship v2", "Release notes", "2026-12-31", false},
		{"empty title", "", "", "2026-12-31", true},
		{"title over limit", strings.Repeat("a", 161), "", "2026-12-31", true},
		{"desc over limit", "Valid", strings.Repeat("d", 1001), "2026-12-31", true},
		{"bad date format", "Valid", "desc", "31-12-2026", true},
		{"empty date", "Valid", "desc", "", true},
		{"title at limit", strings.Repeat("a", 160), "", "2026-01-01", false},
		{"desc at limit", "Valid", strings.Repeat("d", 1000), "2026-01-01", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			title, desc, due, err := Target(tt.title, tt.desc, tt.due)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Target() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil {
				if title != strings.TrimSpace(tt.title) {
					t.Errorf("expected trimmed title %q, got %q", strings.TrimSpace(tt.title), title)
				}
				if desc != strings.TrimSpace(tt.desc) {
					t.Errorf("expected trimmed desc %q, got %q", strings.TrimSpace(tt.desc), desc)
				}
				if due.IsZero() {
					t.Error("expected non-zero due date")
				}
			}
		})
	}
}

func TestDiscussion(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		content string
		wantErr bool
	}{
		{"valid", "What is Go?", "Let's discuss Go language features and patterns", false},
		{"title too short", "Hi", "This is valid content for a discussion post", true},
		{"title at min", "Hello", "This is valid content that is long enough", false},
		{"title at max", strings.Repeat("t", 180), "Valid content that meets the minimum", false},
		{"title over max", strings.Repeat("t", 181), "Valid content that meets the minimum", true},
		{"content too short", "Valid title here", "Short", true},
		{"content at min", "Valid title here", "Exactly 10", false},
		{"content at max", "Valid title here", strings.Repeat("c", 5000), false},
		{"content over max", "Valid title here", strings.Repeat("c", 5001), true},
		{"empty title", "", "Valid content for discussion", true},
		{"empty content", "Valid title", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			title, content, err := Discussion(tt.title, tt.content)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Discussion() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil {
				if title != strings.TrimSpace(tt.title) {
					t.Errorf("expected trimmed title %q, got %q", strings.TrimSpace(tt.title), title)
				}
				if content != strings.TrimSpace(tt.content) {
					t.Errorf("expected trimmed content %q, got %q", strings.TrimSpace(tt.content), content)
				}
			}
		})
	}
}

func TestDiscussionComment(t *testing.T) {
	tests := []struct {
		name    string
		content string
		wantErr bool
	}{
		{"valid", "Great discussion!", false},
		{"empty", "", true},
		{"whitespace only", "   ", true},
		{"single char", "x", false},
		{"at max", strings.Repeat("c", 4000), false},
		{"over max", strings.Repeat("c", 4001), true},
		{"trims to valid", "  hello  ", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content, err := DiscussionComment(tt.content)
			if (err != nil) != tt.wantErr {
				t.Fatalf("DiscussionComment() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && content != strings.TrimSpace(tt.content) {
				t.Errorf("expected trimmed content %q, got %q", strings.TrimSpace(tt.content), content)
			}
		})
	}
}
