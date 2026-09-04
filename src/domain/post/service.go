package post

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

type Service struct {
	Repo     repository.PostRepository
	Versions repository.PostVersionRepository
}

func (s Service) List(ctx context.Context, f repository.PostFilter) ([]model.Post, int64, error) {
	return s.Repo.List(ctx, f)
}
func (s Service) Get(ctx context.Context, slug string) (*model.Post, error) {
	p, e := s.Repo.FindBySlug(ctx, slug)
	if e != nil || (p.Status != "public" && p.Status != "published") {
		return nil, errors.New("post not found")
	}
	return p, nil
}
func (s Service) GetAdmin(ctx context.Context, id primitive.ObjectID) (*model.Post, error) {
	p, err := s.Repo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("post not found")
	}
	return p, nil
}
func (s Service) Create(ctx context.Context, p *model.Post) error {
	if err := normalize(p); err != nil {
		return err
	}
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now
	if p.Status == "public" && p.PublishedAt == nil {
		p.PublishedAt = &now
	}
	if p.IsPinnedOnProfile {
		if err := s.validateProfilePin(ctx, p.AuthorID, primitive.NilObjectID); err != nil {
			return err
		}
	}
	return s.Repo.Create(ctx, p)
}
func (s Service) validateProfilePin(ctx context.Context, authorID, excludeID primitive.ObjectID) error {
	items, _, err := s.Repo.List(ctx, repository.PostFilter{AuthorID: authorID, Page: 1, Limit: 100})
	if err != nil {
		return err
	}
	count := 0
	for _, item := range items {
		if item.ID != excludeID && item.IsPinnedOnProfile {
			count++
		}
	}
	if count >= 2 {
		return errors.New("an author can pin at most two stories")
	}
	return nil
}
func normalize(p *model.Post) error {
	p.Title = strings.TrimSpace(p.Title)
	p.Excerpt = strings.TrimSpace(p.Excerpt)
	p.Content = strings.TrimSpace(p.Content)
	p.Slug = slug(p.Slug)
	if p.Slug == "" {
		p.Slug = slug(p.Title)
	}
	if utf8.RuneCountInString(p.Title) < 3 || utf8.RuneCountInString(p.Title) > 80 || utf8.RuneCountInString(p.Content) < 1 {
		return errors.New("title and content are required")
	}
	if utf8.RuneCountInString(p.Excerpt) > 320 {
		return errors.New("excerpt must be 320 characters or fewer")
	}
	if p.Status != "private" && p.Status != "public" {
		return errors.New("invalid post status")
	}
	return nil
}
func (s Service) Update(ctx context.Context, id primitive.ObjectID, input *model.Post) error {
	p, e := s.Repo.FindByID(ctx, id)
	if e != nil {
		return errors.New("post not found")
	}
	if err := normalize(input); err != nil {
		return err
	}
	if s.Versions != nil {
		if err := s.Versions.Create(ctx, id, p); err != nil {
			return err
		}
	}
	p.Title = input.Title
	p.Slug = input.Slug
	p.Excerpt = input.Excerpt
	p.Content = input.Content
	p.Status = input.Status
	p.IsFeatured = input.IsFeatured
	if input.IsPinnedOnProfile && !p.IsPinnedOnProfile {
		if err := s.validateProfilePin(ctx, p.AuthorID, p.ID); err != nil {
			return err
		}
	}
	p.IsPinnedOnProfile = input.IsPinnedOnProfile
	p.Thumbnail = input.Thumbnail
	p.CategoryIDs = input.CategoryIDs
	p.TagIDs = input.TagIDs
	p.UpdatedAt = time.Now().UTC()
	if p.Status == "public" && p.PublishedAt == nil {
		p.PublishedAt = &p.UpdatedAt
	}
	if p.Status == "private" {
		p.PublishedAt = nil
	}
	return s.Repo.Update(ctx, p)
}

func (s Service) ListVersions(ctx context.Context, id primitive.ObjectID) ([]model.PostVersion, error) {
	if s.Versions == nil {
		return []model.PostVersion{}, nil
	}
	return s.Versions.List(ctx, id)
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slug(v string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(v)), "-"), "-")
}
