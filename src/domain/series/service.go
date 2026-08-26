package series

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"regexp"
	"strings"
	"time"
)

type Service struct {
	Repo  repository.SeriesRepository
	Posts repository.PostRepository
	Users repository.UserRepository
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slug(value string) string {
	return strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(value)), "-"), "-")
}
func (s Service) fill(ctx context.Context, value *model.Series, publicOnly bool) error {
	links, err := s.Repo.ListPosts(ctx, value.ID)
	if err != nil {
		return err
	}
	value.Posts = []model.Post{}
	for _, link := range links {
		postValue, findErr := s.Posts.FindByID(ctx, link.PostID)
		if findErr != nil {
			_ = s.Repo.RemovePost(ctx, value.ID, link.PostID)
			continue
		}
		if publicOnly && postValue.Status != "public" && postValue.Status != "published" {
			continue
		}
		value.Posts = append(value.Posts, *postValue)
	}
	if userValue, err := s.Users.FindByID(ctx, value.AuthorID); err == nil {
		value.Author = userValue
	}
	return nil
}
func (s Service) List(ctx context.Context, authorID primitive.ObjectID, publicOnly, featuredOnly bool) ([]model.Series, error) {
	values, err := s.Repo.List(ctx, authorID, publicOnly, featuredOnly)
	if err != nil {
		return nil, err
	}
	for index := range values {
		if err = s.fill(ctx, &values[index], publicOnly); err != nil {
			return nil, err
		}
	}
	return values, nil
}
func (s Service) GetPublic(ctx context.Context, slugValue string) (*model.Series, error) {
	value, err := s.Repo.FindBySlug(ctx, slugValue)
	if err != nil || value.Status != "published" {
		return nil, errors.New("series not found")
	}
	if err = s.fill(ctx, value, true); err != nil {
		return nil, err
	}
	return value, nil
}
func (s Service) GetManaged(ctx context.Context, id, userID primitive.ObjectID, admin bool) (*model.Series, error) {
	value, err := s.Repo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New("series not found")
	}
	if !admin && value.AuthorID != userID {
		return nil, errors.New("forbidden")
	}
	if err = s.fill(ctx, value, false); err != nil {
		return nil, err
	}
	return value, nil
}
func (s Service) Save(ctx context.Context, id, userID primitive.ObjectID, admin bool, input *model.Series) (*model.Series, error) {
	input.Title = strings.TrimSpace(input.Title)
	if len(input.Title) < 3 {
		return nil, errors.New("series title is required")
	}
	if input.Status != "draft" && input.Status != "published" {
		return nil, errors.New("invalid series status")
	}
	now := time.Now().UTC()
	if id.IsZero() {
		input.AuthorID = userID
		input.ID = primitive.NewObjectID()
		input.Slug = slug(input.Title)
		if input.Slug == "" {
			input.Slug = "series-" + input.ID.Hex()
		}
		input.IsFeatured = input.IsFeatured && admin
		input.CreatedAt = now
		input.UpdatedAt = now
		if err := s.Repo.Create(ctx, input); err != nil {
			return nil, err
		}
	} else {
		existing, err := s.GetManaged(ctx, id, userID, admin)
		if err != nil {
			return nil, err
		}
		existing.Title = input.Title
		existing.Slug = slug(input.Title)
		if existing.Slug == "" {
			existing.Slug = "series-" + existing.ID.Hex()
		}
		existing.Description = strings.TrimSpace(input.Description)
		existing.CoverImage = input.CoverImage
		existing.Status = input.Status
		existing.IsFeatured = input.IsFeatured && admin
		existing.UpdatedAt = now
		if err = s.Repo.Update(ctx, existing); err != nil {
			return nil, err
		}
		input = existing
	}
	return input, nil
}
func (s Service) SetPosts(ctx context.Context, id, userID primitive.ObjectID, admin bool, postIDs []primitive.ObjectID) error {
	value, err := s.GetManaged(ctx, id, userID, admin)
	if err != nil {
		return err
	}
	valid := make([]primitive.ObjectID, 0, len(postIDs))
	seen := map[primitive.ObjectID]bool{}
	for _, postID := range postIDs {
		if seen[postID] {
			continue
		}
		postValue, findErr := s.Posts.FindByID(ctx, postID)
		if findErr == nil && (admin || postValue.AuthorID == value.AuthorID) {
			valid = append(valid, postID)
			seen[postID] = true
		}
	}
	return s.Repo.ReplacePosts(ctx, id, valid)
}
func (s Service) ForPost(ctx context.Context, postID primitive.ObjectID) (*model.Series, error) {
	link, err := s.Repo.FindByPost(ctx, postID)
	if err != nil {
		return nil, err
	}
	value, err := s.Repo.FindByID(ctx, link.SeriesID)
	if err != nil || value.Status != "published" {
		return nil, errors.New("series not found")
	}
	if err = s.fill(ctx, value, true); err != nil {
		return nil, err
	}
	return value, nil
}
