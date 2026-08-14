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
	Phone        string             `bson:"phone,omitempty" json:"phone,omitempty"`
	Role         string             `bson:"role" json:"role"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}
type Media struct {
	Key string `bson:"key" json:"key"`
	URL string `bson:"url" json:"url"`
}
type Post struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Title       string               `bson:"title" json:"title"`
	Slug        string               `bson:"slug" json:"slug"`
	Excerpt     string               `bson:"excerpt" json:"excerpt"`
	Content     string               `bson:"content" json:"content"`
	Thumbnail   *Media               `bson:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	AuthorID    primitive.ObjectID   `bson:"author_id" json:"author_id"`
	CategoryIDs []primitive.ObjectID `bson:"category_ids" json:"category_ids"`
	TagIDs      []primitive.ObjectID `bson:"tag_ids" json:"tag_ids"`
	Status      string               `bson:"status" json:"status"`
	PublishedAt *time.Time           `bson:"published_at,omitempty" json:"published_at,omitempty"`
	CreatedAt   time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time            `bson:"updated_at" json:"updated_at"`
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
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	PostID    primitive.ObjectID `bson:"post_id" json:"post_id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	Content   string             `bson:"content" json:"content"`
	Status    string             `bson:"status" json:"status"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}
type RefreshSession struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"user_id"`
	TokenHash string             `bson:"token_hash"`
	ExpiresAt time.Time          `bson:"expires_at"`
	CreatedAt time.Time          `bson:"created_at"`
}
