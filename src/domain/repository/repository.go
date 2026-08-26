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
type UserBatchRepository interface {
	FindByIDs(context.Context, []primitive.ObjectID) ([]model.User, error)
}
type PublicAuthorRepository interface {
	FindByUsername(context.Context, string) (*model.User, error)
	UpdateAuthorProfile(context.Context, primitive.ObjectID, string, model.SocialLinks) error
}
type PostFilter struct {
	Status, Search, Category, Tag string
	Page, Limit                   int
	FeaturedOnly                  bool
	AuthorID                      primitive.ObjectID
	DateFrom, DateTo              time.Time
}
type PostVersionRepository interface {
	Create(context.Context, primitive.ObjectID, *model.Post) error
	List(context.Context, primitive.ObjectID) ([]model.PostVersion, error)
}
type PostDraftRepository interface {
	GetDraft(context.Context, primitive.ObjectID) (*model.PostDraft, error)
	SaveDraft(context.Context, primitive.ObjectID, *model.PostDraft) (bool, error)
	DeleteDraft(context.Context, primitive.ObjectID) error
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
type PostReactionRepository interface {
	TogglePostReaction(context.Context, primitive.ObjectID, primitive.ObjectID, string) (*model.Post, error)
}
type CommentInteractionRepository interface {
	ToggleCommentReaction(context.Context, primitive.ObjectID, primitive.ObjectID, string) (*model.Comment, error)
	PinComment(context.Context, primitive.ObjectID, primitive.ObjectID, bool) error
}
type SessionRepository interface {
	Create(context.Context, *model.RefreshSession) error
	FindByHash(context.Context, string) (*model.RefreshSession, error)
	DeleteByHash(context.Context, string) error
	DeleteByUser(context.Context, primitive.ObjectID) error
}
type BookmarkRepository interface {
	ListPostIDs(context.Context, primitive.ObjectID) ([]primitive.ObjectID, error)
	Create(context.Context, *model.Bookmark) error
	Delete(context.Context, primitive.ObjectID, primitive.ObjectID) error
}
type FollowRepository interface {
	Create(context.Context, *model.Follow) error
	Delete(context.Context, primitive.ObjectID, primitive.ObjectID) error
	Exists(context.Context, primitive.ObjectID, primitive.ObjectID) (bool, error)
	Count(context.Context, primitive.ObjectID) (int64, error)
	ListAuthorIDs(context.Context, primitive.ObjectID) ([]primitive.ObjectID, error)
}
type SeriesRepository interface {
	Create(context.Context, *model.Series) error
	Update(context.Context, *model.Series) error
	Delete(context.Context, primitive.ObjectID) error
	FindByID(context.Context, primitive.ObjectID) (*model.Series, error)
	FindBySlug(context.Context, string) (*model.Series, error)
	List(context.Context, primitive.ObjectID, bool, bool) ([]model.Series, error)
	ReplacePosts(context.Context, primitive.ObjectID, []primitive.ObjectID) error
	ListPosts(context.Context, primitive.ObjectID) ([]model.SeriesPost, error)
	FindByPost(context.Context, primitive.ObjectID) (*model.SeriesPost, error)
	RemovePost(context.Context, primitive.ObjectID, primitive.ObjectID) error
}
type PasswordResetRepository interface {
	Create(context.Context, *model.PasswordReset) error
	FindByHash(context.Context, string) (*model.PasswordReset, error)
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
