package repository

import (
	"context"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"time"
)

type UserRepository interface {
	Create(context.Context, *model.User) error
	FindByEmail(context.Context, string) (*model.User, error)
	FindByID(context.Context, primitive.ObjectID) (*model.User, error)
	UpdateProfile(context.Context, primitive.ObjectID, string, string) error
	UpdatePassword(context.Context, primitive.ObjectID, string) error
	UpdateAvatar(context.Context, primitive.ObjectID, string) error
}
type PostFilter struct {
	Status, Search, Category, Tag string
	Page, Limit                   int
	AuthorID                      primitive.ObjectID
	DateFrom, DateTo              time.Time
}
type PostVersionRepository interface {
	Create(context.Context, primitive.ObjectID, *model.Post) error
	List(context.Context, primitive.ObjectID) ([]model.PostVersion, error)
}
type PostRepository interface {
	List(context.Context, PostFilter) ([]model.Post, int64, error)
	FindBySlug(context.Context, string) (*model.Post, error)
	FindByID(context.Context, primitive.ObjectID) (*model.Post, error)
	Create(context.Context, *model.Post) error
	Update(context.Context, *model.Post) error
	Delete(context.Context, primitive.ObjectID) error
}
type CommentRepository interface {
	ListByPost(context.Context, primitive.ObjectID) ([]model.Comment, error)
	List(context.Context) ([]model.Comment, error)
	FindByID(context.Context, primitive.ObjectID) (*model.Comment, error)
	Create(context.Context, *model.Comment) error
	UpdateStatus(context.Context, primitive.ObjectID, string) error
	Delete(context.Context, primitive.ObjectID) error
}
type SessionRepository interface {
	Create(context.Context, *model.RefreshSession) error
	FindByHash(context.Context, string) (*model.RefreshSession, error)
	DeleteByHash(context.Context, string) error
	DeleteByUser(context.Context, primitive.ObjectID) error
}
type TaxonomyRepository interface {
	ListCategories(context.Context) ([]model.Category, error)
	FindCategoryBySlug(context.Context, string) (*model.Category, error)
	CreateCategory(context.Context, *model.Category) error
	UpdateCategory(context.Context, *model.Category) error
	DeleteCategory(context.Context, primitive.ObjectID) error
	ListTags(context.Context) ([]model.Tag, error)
	FindTagBySlug(context.Context, string) (*model.Tag, error)
	CreateTag(context.Context, *model.Tag) error
	UpdateTag(context.Context, *model.Tag) error
	DeleteTag(context.Context, primitive.ObjectID) error
}
