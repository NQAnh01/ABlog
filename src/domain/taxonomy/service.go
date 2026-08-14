package taxonomy

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
)

type Service struct{ Repo repository.TaxonomyRepository }

func (s Service) Categories(ctx context.Context) ([]model.Category, error) {
	return s.Repo.ListCategories(ctx)
}
func (s Service) Category(ctx context.Context, slug string) (*model.Category, error) {
	return s.Repo.FindCategoryBySlug(ctx, slug)
}
func (s Service) Tags(ctx context.Context) ([]model.Tag, error) { return s.Repo.ListTags(ctx) }
func (s Service) Tag(ctx context.Context, slug string) (*model.Tag, error) {
	return s.Repo.FindTagBySlug(ctx, slug)
}
func (s Service) SaveCategory(ctx context.Context, id primitive.ObjectID, v *model.Category) error {
	v.Name = strings.TrimSpace(v.Name)
	if len(v.Name) < 2 {
		return errors.New("category name is required")
	}
	v.Slug = toSlug(v.Slug)
	if v.Slug == "" {
		v.Slug = toSlug(v.Name)
	}
	now := time.Now().UTC()
	v.UpdatedAt = now
	if id.IsZero() {
		v.CreatedAt = now
		return s.Repo.CreateCategory(ctx, v)
	}
	v.ID = id
	return s.Repo.UpdateCategory(ctx, v)
}
func (s Service) SaveTag(ctx context.Context, id primitive.ObjectID, v *model.Tag) error {
	v.Name = strings.TrimSpace(v.Name)
	if len(v.Name) < 2 {
		return errors.New("tag name is required")
	}
	v.Slug = toSlug(v.Slug)
	if v.Slug == "" {
		v.Slug = toSlug(v.Name)
	}
	now := time.Now().UTC()
	v.UpdatedAt = now
	if id.IsZero() {
		v.CreatedAt = now
		return s.Repo.CreateTag(ctx, v)
	}
	v.ID = id
	return s.Repo.UpdateTag(ctx, v)
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func toSlug(v string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(v)), "-"), "-")
}
