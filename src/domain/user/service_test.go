package user

import (
	"context"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"lumina/src/domain/model"
	"testing"
	"time"
)

type usersFake struct{ byEmail map[string]*model.User }

func (f *usersFake) Create(_ context.Context, u *model.User) error {
	u.ID = primitive.NewObjectID()
	f.byEmail[u.Email] = u
	return nil
}
func (f *usersFake) FindByEmail(_ context.Context, e string) (*model.User, error) {
	u, ok := f.byEmail[e]
	if !ok {
		return nil, mongo.ErrNoDocuments
	}
	return u, nil
}
func (f *usersFake) FindByID(_ context.Context, id primitive.ObjectID) (*model.User, error) {
	for _, u := range f.byEmail {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, mongo.ErrNoDocuments
}
func (f *usersFake) UpdateProfile(_ context.Context, id primitive.ObjectID, name, phone string) error {
	for _, u := range f.byEmail {
		if u.ID == id {
			u.Name, u.Phone = name, phone
			return nil
		}
	}
	return mongo.ErrNoDocuments
}
func (f *usersFake) UpdatePassword(_ context.Context, id primitive.ObjectID, hash string) error {
	for _, u := range f.byEmail {
		if u.ID == id {
			u.PasswordHash = hash
			return nil
		}
	}
	return mongo.ErrNoDocuments
}
func (f *usersFake) UpdateAvatar(_ context.Context, id primitive.ObjectID, avatar string) error {
	for _, u := range f.byEmail {
		if u.ID == id {
			u.Avatar = avatar
			return nil
		}
	}
	return mongo.ErrNoDocuments
}

type sessionsFake struct {
	items   map[string]*model.RefreshSession
	revoked bool
}

func (f *sessionsFake) Create(_ context.Context, v *model.RefreshSession) error {
	f.items[v.TokenHash] = v
	return nil
}
func (f *sessionsFake) FindByHash(_ context.Context, h string) (*model.RefreshSession, error) {
	v, ok := f.items[h]
	if !ok {
		return nil, mongo.ErrNoDocuments
	}
	return v, nil
}
func (f *sessionsFake) DeleteByHash(_ context.Context, h string) error {
	delete(f.items, h)
	return nil
}
func (f *sessionsFake) DeleteByUser(_ context.Context, id primitive.ObjectID) error {
	f.revoked = true
	return nil
}
func TestRegisterLoginAndParseAccess(t *testing.T) {
	users := &usersFake{byEmail: map[string]*model.User{}}
	sessions := &sessionsFake{items: map[string]*model.RefreshSession{}}
	s := Service{Users: users, Sessions: sessions, Secret: []byte("test-secret"), AccessTTL: time.Minute, RefreshTTL: time.Hour}
	tokens, e := s.Register(context.Background(), "Ada Lovelace", "ADA@example.com", "correct-horse")
	if e != nil {
		t.Fatal(e)
	}
	if tokens.User.Email != "ada@example.com" || tokens.User.PasswordHash == "correct-horse" {
		t.Fatal("user was not normalized and hashed")
	}
	login, e := s.Login(context.Background(), "ada@example.com", "correct-horse")
	if e != nil {
		t.Fatal(e)
	}
	id, role, e := s.ParseAccess(login.Access)
	if e != nil || id != tokens.User.ID || role != "user" {
		t.Fatalf("invalid claims: %v %v", role, e)
	}
	if _, e = s.Login(context.Background(), "ada@example.com", "wrong-password"); e == nil {
		t.Fatal("wrong password should fail")
	}
}

func TestUpdateProfileAndChangePassword(t *testing.T) {
	users := &usersFake{byEmail: map[string]*model.User{}}
	sessions := &sessionsFake{items: map[string]*model.RefreshSession{}}
	s := Service{Users: users, Sessions: sessions, Secret: []byte("test-secret"), AccessTTL: time.Minute, RefreshTTL: time.Hour}
	tokens, err := s.Register(context.Background(), "Initial Name", "profile@example.com", "old-password")
	if err != nil {
		t.Fatal(err)
	}
	updated, err := s.UpdateProfile(context.Background(), tokens.User.ID, "Updated Name", "+84 901 234 567")
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "Updated Name" || updated.Phone != "+84 901 234 567" {
		t.Fatalf("unexpected profile: %+v", updated)
	}
	if _, err = s.UpdateProfile(context.Background(), tokens.User.ID, "Updated Name", "not-a-phone"); err == nil {
		t.Fatal("invalid phone should fail")
	}
	if err = s.ChangePassword(context.Background(), tokens.User.ID, "wrong-password", "new-password", "new-password"); err == nil {
		t.Fatal("wrong current password should fail")
	}
	if err = s.ChangePassword(context.Background(), tokens.User.ID, "old-password", "new-password", "different"); err == nil {
		t.Fatal("mismatched confirmation should fail")
	}
	if err = s.ChangePassword(context.Background(), tokens.User.ID, "old-password", "new-password", "new-password"); err != nil {
		t.Fatal(err)
	}
	if !sessions.revoked {
		t.Fatal("password change must revoke refresh sessions")
	}
	if _, err = s.Login(context.Background(), "profile@example.com", "old-password"); err == nil {
		t.Fatal("old password should no longer work")
	}
	if _, err = s.Login(context.Background(), "profile@example.com", "new-password"); err != nil {
		t.Fatalf("new password should work: %v", err)
	}
}
