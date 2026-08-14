package user

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"net/mail"
	"regexp"
	"strings"
	"time"
)

var ErrInvalidCredentials = errors.New("invalid email or password")

type Service struct {
	Users                 repository.UserRepository
	Sessions              repository.SessionRepository
	Secret                []byte
	AccessTTL, RefreshTTL time.Duration
}
type Tokens struct {
	Access, Refresh string
	User            *model.User
}

func (s Service) Register(ctx context.Context, name, email, password string) (*Tokens, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if _, e := mail.ParseAddress(email); e != nil || len(password) < 8 || len(name) < 2 {
		return nil, errors.New("name, valid email and password of at least 8 characters are required")
	}
	if _, e := s.Users.FindByEmail(ctx, email); e == nil {
		return nil, errors.New("email already registered")
	}
	hash, e := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if e != nil {
		return nil, e
	}
	now := time.Now().UTC()
	u := &model.User{Email: email, PasswordHash: string(hash), Name: name, Role: "user", CreatedAt: now, UpdatedAt: now}
	if e = s.Users.Create(ctx, u); e != nil {
		return nil, e
	}
	return s.issue(ctx, u)
}
func (s Service) Login(ctx context.Context, email, password string) (*Tokens, error) {
	u, e := s.Users.FindByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if e != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return nil, ErrInvalidCredentials
	}
	return s.issue(ctx, u)
}
func (s Service) issue(ctx context.Context, u *model.User) (*Tokens, error) {
	now := time.Now()
	claims := jwt.MapClaims{"sub": u.ID.Hex(), "role": u.Role, "iat": now.Unix(), "exp": now.Add(s.AccessTTL).Unix()}
	access, e := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.Secret)
	if e != nil {
		return nil, e
	}
	raw := make([]byte, 32)
	if _, e = rand.Read(raw); e != nil {
		return nil, e
	}
	refresh := base64.RawURLEncoding.EncodeToString(raw)
	sum := sha256.Sum256([]byte(refresh))
	e = s.Sessions.Create(ctx, &model.RefreshSession{UserID: u.ID, TokenHash: base64.RawURLEncoding.EncodeToString(sum[:]), ExpiresAt: now.Add(s.RefreshTTL), CreatedAt: now})
	if e != nil {
		return nil, e
	}
	return &Tokens{Access: access, Refresh: refresh, User: u}, nil
}
func (s Service) Refresh(ctx context.Context, token string) (*Tokens, error) {
	sum := sha256.Sum256([]byte(token))
	h := base64.RawURLEncoding.EncodeToString(sum[:])
	session, e := s.Sessions.FindByHash(ctx, h)
	if e != nil {
		return nil, ErrInvalidCredentials
	}
	u, e := s.Users.FindByID(ctx, session.UserID)
	if e != nil {
		return nil, ErrInvalidCredentials
	}
	_ = s.Sessions.DeleteByHash(ctx, h)
	return s.issue(ctx, u)
}
func (s Service) Logout(ctx context.Context, token string) error {
	sum := sha256.Sum256([]byte(token))
	return s.Sessions.DeleteByHash(ctx, base64.RawURLEncoding.EncodeToString(sum[:]))
}

var phonePattern = regexp.MustCompile(`^[+0-9 ()-]{7,20}$`)

func (s Service) UpdateProfile(ctx context.Context, id primitive.ObjectID, name, phone string) (*model.User, error) {
	name, phone = strings.TrimSpace(name), strings.TrimSpace(phone)
	if len(name) < 2 || len(name) > 80 {
		return nil, errors.New("name must be between 2 and 80 characters")
	}
	if phone != "" && !phonePattern.MatchString(phone) {
		return nil, errors.New("invalid phone number")
	}
	if err := s.Users.UpdateProfile(ctx, id, name, phone); err != nil {
		return nil, err
	}
	return s.Users.FindByID(ctx, id)
}

func (s Service) ChangePassword(ctx context.Context, id primitive.ObjectID, current, next, confirm string) error {
	if next != confirm {
		return errors.New("new password confirmation does not match")
	}
	if len(next) < 8 || len(next) > 128 {
		return errors.New("new password must be between 8 and 128 characters")
	}
	u, err := s.Users.FindByID(ctx, id)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(current)) != nil {
		return errors.New("current password is incorrect")
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(next)) == nil {
		return errors.New("new password must be different from current password")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err = s.Users.UpdatePassword(ctx, id, string(hash)); err != nil {
		return err
	}
	return s.Sessions.DeleteByUser(ctx, id)
}
func (s Service) UpdateAvatar(ctx context.Context, id primitive.ObjectID, avatar string) (*model.User, error) {
	if strings.TrimSpace(avatar) == "" {
		return nil, errors.New("avatar URL is required")
	}
	if err := s.Users.UpdateAvatar(ctx, id, avatar); err != nil {
		return nil, err
	}
	return s.Users.FindByID(ctx, id)
}
func (s Service) ParseAccess(token string) (primitive.ObjectID, string, error) {
	v, e := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("invalid signing method")
		}
		return s.Secret, nil
	})
	if e != nil || !v.Valid {
		return primitive.NilObjectID, "", ErrInvalidCredentials
	}
	c, ok := v.Claims.(jwt.MapClaims)
	if !ok {
		return primitive.NilObjectID, "", ErrInvalidCredentials
	}
	id, e := primitive.ObjectIDFromHex(c["sub"].(string))
	if e != nil {
		return primitive.NilObjectID, "", e
	}
	role, _ := c["role"].(string)
	return id, role, nil
}
