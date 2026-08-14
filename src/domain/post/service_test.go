package post

import (
	"context"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"testing"
)

type repoFake struct {
	items map[primitive.ObjectID]*model.Post
}

func (f *repoFake) List(context.Context, repository.PostFilter) ([]model.Post, int64, error) {
	return nil, 0, nil
}
func (f *repoFake) FindBySlug(_ context.Context, s string) (*model.Post, error) {
	for _, p := range f.items {
		if p.Slug == s {
			return p, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}
func (f *repoFake) FindByID(_ context.Context, id primitive.ObjectID) (*model.Post, error) {
	p, ok := f.items[id]
	if !ok {
		return nil, mongo.ErrNoDocuments
	}
	return p, nil
}
func (f *repoFake) Create(_ context.Context, p *model.Post) error {
	p.ID = primitive.NewObjectID()
	f.items[p.ID] = p
	return nil
}
func (f *repoFake) Update(_ context.Context, p *model.Post) error { f.items[p.ID] = p; return nil }
func (f *repoFake) Delete(_ context.Context, id primitive.ObjectID) error {
	delete(f.items, id)
	return nil
}
func TestCreateUpdateAndGetPublicPost(t *testing.T) {
	r := &repoFake{items: map[primitive.ObjectID]*model.Post{}}
	s := Service{Repo: r}
	p := &model.Post{Title: "Quiet Interfaces", Content: "Body", Status: "public"}
	if e := s.Create(context.Background(), p); e != nil {
		t.Fatal(e)
	}
	if p.Slug != "quiet-interfaces" || p.PublishedAt == nil {
		t.Fatal("create did not set public timestamp")
	}
	got, e := s.Get(context.Background(), p.Slug)
	if e != nil || got.ID != p.ID {
		t.Fatal("public post not found")
	}
	if e = s.Update(context.Background(), p.ID, &model.Post{Title: "Quieter Interfaces", Content: "New", Status: "private"}); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Get(context.Background(), "quieter-interfaces"); e == nil {
		t.Fatal("private post must not be public")
	}
}

func TestPostValidationAndVisibilityTransitions(t *testing.T) {
	r := &repoFake{items: map[primitive.ObjectID]*model.Post{}}
	s := Service{Repo: r}
	if err := s.Create(context.Background(), &model.Post{Title: "No body", Status: "private"}); err == nil {
		t.Fatal("empty content should fail")
	}
	if err := s.Create(context.Background(), &model.Post{Title: "A valid title", Content: "Body", Excerpt: string(make([]byte, 321)), Status: "private"}); err == nil {
		t.Fatal("excerpt over 320 characters should fail")
	}
	p := &model.Post{Title: "A Private Story", Content: "Body", Status: "private"}
	if err := s.Create(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	if p.PublishedAt != nil {
		t.Fatal("private post must not have a public timestamp")
	}
	if err := s.Update(context.Background(), p.ID, &model.Post{Title: p.Title, Content: p.Content, Status: "public"}); err != nil {
		t.Fatal(err)
	}
	if r.items[p.ID].PublishedAt == nil {
		t.Fatal("making a post public must set the public timestamp")
	}
	if err := s.Update(context.Background(), p.ID, &model.Post{Title: p.Title, Content: p.Content, Status: "private"}); err != nil {
		t.Fatal(err)
	}
	if r.items[p.ID].PublishedAt != nil {
		t.Fatal("making a post private must clear the public timestamp")
	}
}
