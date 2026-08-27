package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash" json:"-"`
	Name         string             `bson:"name" json:"name"`
	Avatar       string             `bson:"avatar,omitempty" json:"avatar,omitempty"`
	Username     string             `bson:"username,omitempty" json:"username,omitempty"`
	Bio          string             `bson:"bio,omitempty" json:"bio,omitempty"`
	SocialLinks  SocialLinks        `bson:"social_links,omitempty" json:"social_links,omitempty"`
	Phone        string             `bson:"phone,omitempty" json:"phone,omitempty"`
	Role         string             `bson:"role" json:"role"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

// PublicUserDTO is the only user representation that may be embedded in
// public resources. Keep account, authorization and credential fields on User.
type PublicUserDTO struct {
	ID          primitive.ObjectID `json:"id"`
	Username    string             `json:"username,omitempty"`
	Name        string             `json:"name"`
	Avatar      string             `json:"avatar,omitempty"`
	Bio         string             `json:"bio,omitempty"`
	SocialLinks SocialLinks        `json:"social_links,omitempty"`
}

func ToPublicUserDTO(value *User) *PublicUserDTO {
	if value == nil {
		return nil
	}
	return &PublicUserDTO{
		ID:          value.ID,
		Username:    value.Username,
		Name:        value.Name,
		Avatar:      value.Avatar,
		Bio:         value.Bio,
		SocialLinks: value.SocialLinks,
	}
}

type SocialLinks struct {
	Website  string       `bson:"website,omitempty" json:"website,omitempty"`
	X        string       `bson:"x,omitempty" json:"x,omitempty"`
	LinkedIn string       `bson:"linkedin,omitempty" json:"linkedin,omitempty"`
	Links    []SocialLink `bson:"links,omitempty" json:"links,omitempty"`
}
type SocialLink struct {
	Name string `bson:"name" json:"name"`
	URL  string `bson:"url" json:"url"`
}
type Media struct {
	Key string `bson:"key" json:"key"`
	URL string `bson:"url" json:"url"`
}
type Post struct {
	ID                primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Title             string               `bson:"title" json:"title"`
	Slug              string               `bson:"slug" json:"slug"`
	Excerpt           string               `bson:"excerpt" json:"excerpt"`
	Content           string               `bson:"content" json:"content"`
	Thumbnail         *Media               `bson:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	AuthorID          primitive.ObjectID   `bson:"author_id" json:"author_id"`
	CategoryIDs       []primitive.ObjectID `bson:"category_ids" json:"category_ids"`
	TagIDs            []primitive.ObjectID `bson:"tag_ids" json:"tag_ids"`
	Status            string               `bson:"status" json:"status"`
	IsFeatured        bool                 `bson:"is_featured,omitempty" json:"is_featured"`
	IsPinnedOnProfile bool                 `bson:"is_pinned_on_profile,omitempty" json:"is_pinned_on_profile"`
	PublishedAt       *time.Time           `bson:"published_at,omitempty" json:"published_at,omitempty"`
	CreatedAt         time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt         time.Time            `bson:"updated_at" json:"updated_at"`
	Author            *PublicUserDTO       `bson:"-" json:"author,omitempty"`
	Autosave          *PostDraft           `bson:"autosave,omitempty" json:"-"`
	Reactions         []Reaction           `bson:"reactions,omitempty" json:"reactions,omitempty"`
}
type PostDraft struct {
	Title             string               `bson:"title" json:"title"`
	Slug              string               `bson:"slug" json:"slug"`
	Excerpt           string               `bson:"excerpt" json:"excerpt"`
	Content           string               `bson:"content" json:"content"`
	Thumbnail         *Media               `bson:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	CategoryIDs       []primitive.ObjectID `bson:"category_ids" json:"category_ids"`
	TagIDs            []primitive.ObjectID `bson:"tag_ids" json:"tag_ids"`
	Status            string               `bson:"status" json:"status"`
	IsFeatured        bool                 `bson:"is_featured,omitempty" json:"is_featured"`
	IsPinnedOnProfile bool                 `bson:"is_pinned_on_profile,omitempty" json:"is_pinned_on_profile"`
	Sequence          int64                `bson:"sequence" json:"sequence"`
	UpdatedAt         time.Time            `bson:"updated_at" json:"updated_at"`
}
type PostVersion struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PostID    primitive.ObjectID `bson:"post_id" json:"post_id"`
	Number    int                `bson:"number" json:"number"`
	Snapshot  Post               `bson:"snapshot" json:"snapshot"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}
type Category struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"`
	Slug        string             `bson:"slug" json:"slug"`
	Description string             `bson:"description" json:"description"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}
type Tag struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Slug      string             `bson:"slug" json:"slug"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}
type Comment struct {
	ID        primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	PostID    primitive.ObjectID   `bson:"post_id" json:"post_id"`
	UserID    primitive.ObjectID   `bson:"user_id" json:"user_id"`
	Content   string               `bson:"content" json:"content"`
	Status    string               `bson:"status" json:"status"`
	CreatedAt time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time            `bson:"updated_at" json:"updated_at"`
	ParentID  primitive.ObjectID   `bson:"parent_id,omitempty" json:"parent_id,omitempty"`
	Mentions  []primitive.ObjectID `bson:"mention_ids,omitempty" json:"mention_ids,omitempty"`
	Reactions []Reaction           `bson:"reactions,omitempty" json:"reactions,omitempty"`
	IsPinned  bool                 `bson:"is_pinned,omitempty" json:"is_pinned"`
	User      *PublicUserDTO       `bson:"-" json:"user,omitempty"`
}
type Reaction struct {
	UserID primitive.ObjectID `bson:"user_id" json:"user_id"`
	Type   string             `bson:"type" json:"type"`
}
type RefreshSession struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	TokenHash string             `bson:"token_hash"`
	ExpiresAt time.Time          `bson:"expires_at"`
	CreatedAt time.Time          `bson:"created_at"`
}
type Bookmark struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	PostID    primitive.ObjectID `bson:"post_id" json:"post_id"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}
type Follow struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	FollowerID primitive.ObjectID `bson:"follower_id" json:"follower_id"`
	AuthorID   primitive.ObjectID `bson:"author_id" json:"author_id"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
}
type PasswordReset struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	TokenHash string             `bson:"token_hash"`
	ExpiresAt time.Time          `bson:"expires_at"`
	CreatedAt time.Time          `bson:"created_at"`
}
type Series struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Slug        string             `bson:"slug" json:"slug"`
	Description string             `bson:"description" json:"description"`
	CoverImage  *Media             `bson:"cover_image,omitempty" json:"cover_image,omitempty"`
	AuthorID    primitive.ObjectID `bson:"author_id" json:"author_id"`
	Status      string             `bson:"status" json:"status"`
	IsFeatured  bool               `bson:"is_featured,omitempty" json:"is_featured"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
	Author      *PublicUserDTO     `bson:"-" json:"author,omitempty"`
	Posts       []Post             `bson:"-" json:"posts,omitempty"`
}
type SeriesPost struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SeriesID primitive.ObjectID `bson:"series_id" json:"series_id"`
	PostID   primitive.ObjectID `bson:"post_id" json:"post_id"`
	Order    int                `bson:"order" json:"order"`
}
