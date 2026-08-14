package comment

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"strings"
	"time"
)

type Service struct {
	Comments repository.CommentRepository
	Posts    repository.PostRepository
}

func (s Service) List(ctx context.Context, slug string) ([]model.Comment, error) {
	p, e := s.Posts.FindBySlug(ctx, slug)
	if e != nil {
		return nil, errors.New("post not found")
	}
	return s.Comments.ListByPost(ctx, p.ID)
}
func (s Service) Create(ctx context.Context, slug string, userID primitive.ObjectID, content string) (*model.Comment, error) {
	p, e := s.Posts.FindBySlug(ctx, slug)
	if e != nil {
		return nil, errors.New("post not found")
	}
	content = strings.TrimSpace(content)
	if len(content) < 2 || len(content) > 4000 {
		return nil, errors.New("comment must be between 2 and 4000 characters")
	}
	now := time.Now().UTC()
	c := &model.Comment{PostID: p.ID, UserID: userID, Content: content, Status: "approved", CreatedAt: now, UpdatedAt: now}
	if e = s.Comments.Create(ctx, c); e != nil {
		return nil, e
	}
	return c, nil
}
func (s Service) Delete(ctx context.Context, id, userID primitive.ObjectID, admin bool) error {
	c, e := s.Comments.FindByID(ctx, id)
	if e != nil {
		return errors.New("comment not found")
	}
	if !admin && c.UserID != userID {
		return errors.New("forbidden")
	}
	return s.Comments.Delete(ctx, id)
}
