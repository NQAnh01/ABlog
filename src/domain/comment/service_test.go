package comment

import (
	"context"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"testing"
)

type commentsFake struct {
	item    *model.Comment
	deleted bool
}

func (f *commentsFake) ListByPost(context.Context, primitive.ObjectID) ([]model.Comment, error) {
	return nil, nil
}
func (f *commentsFake) List(context.Context) ([]model.Comment, error) { return nil, nil }
func (f *commentsFake) FindByID(context.Context, primitive.ObjectID) (*model.Comment, error) {
	if f.item == nil {
		return nil, mongo.ErrNoDocuments
	}
	return f.item, nil
}
func (f *commentsFake) Create(_ context.Context, c *model.Comment) error {
	c.ID = primitive.NewObjectID()
	f.item = c
	return nil
}
func (f *commentsFake) UpdateStatus(context.Context, primitive.ObjectID, string) error { return nil }
func (f *commentsFake) Delete(context.Context, primitive.ObjectID) error {
	f.deleted = true
	return nil
}

type postsFake struct{ post *model.Post }

func (f postsFake) List(context.Context, repository.PostFilter) ([]model.Post, int64, error) {
	return nil, 0, nil
}
func (f postsFake) FindBySlug(context.Context, string) (*model.Post, error) { return f.post, nil }
func (f postsFake) FindByID(context.Context, primitive.ObjectID) (*model.Post, error) {
	return f.post, nil
}
func (f postsFake) Create(context.Context, *model.Post) error        { return nil }
func (f postsFake) Update(context.Context, *model.Post) error        { return nil }
func (f postsFake) Delete(context.Context, primitive.ObjectID) error { return nil }
func TestCommentPermission(t *testing.T) {
	owner := primitive.NewObjectID()
	other := primitive.NewObjectID()
	repo := &commentsFake{item: &model.Comment{ID: primitive.NewObjectID(), UserID: owner}}
	s := Service{Comments: repo, Posts: postsFake{post: &model.Post{ID: primitive.NewObjectID()}}}
	if e := s.Delete(context.Background(), repo.item.ID, other, false); e == nil {
		t.Fatal("non-owner deletion should fail")
	}
	if e := s.Delete(context.Background(), repo.item.ID, owner, false); e != nil || !repo.deleted {
		t.Fatal("owner should delete comment")
	}
}
