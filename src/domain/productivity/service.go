// Package productivity contains the business rules for targets, todos and
// discussions. Persistence stays in the API layer for now, but all writes use
// these rules so the constraints have one source of truth.
package productivity

import (
	"errors"
	"strings"
	"time"
)

func Todo(title, notes string) (string, string, error) {
	title, notes = strings.TrimSpace(title), strings.TrimSpace(notes)
	if title == "" || len(title) > 160 || len(notes) > 1000 {
		return "", "", errors.New("todo title or notes are invalid")
	}
	return title, notes, nil
}

func Target(title, description, dueDate string) (string, string, time.Time, error) {
	title, description = strings.TrimSpace(title), strings.TrimSpace(description)
	due, err := time.Parse("2006-01-02", dueDate)
	if title == "" || len(title) > 160 || len(description) > 1000 || err != nil {
		return "", "", time.Time{}, errors.New("target title, description or due date is invalid")
	}
	return title, description, due.UTC(), nil
}

func Discussion(title, content string) (string, string, error) {
	title, content = strings.TrimSpace(title), strings.TrimSpace(content)
	if len(title) < 5 || len(title) > 180 || len(content) < 10 || len(content) > 5000 {
		return "", "", errors.New("discussion title or content are invalid")
	}
	return title, content, nil
}

func DiscussionComment(content string) (string, error) {
	content = strings.TrimSpace(content)
	if len(content) < 1 || len(content) > 4000 {
		return "", errors.New("discussion comment is invalid")
	}
	return content, nil
}
