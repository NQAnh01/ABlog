package seed

import (
	"context"
	"errors"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
	"log"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
	"lumina/src/infrastructure/config"
	db "lumina/src/infrastructure/database/mongodb"
	"time"
)

func Run(ctx context.Context, c config.Config, r *db.Repositories) error {
	if c.SeedAdminEmail == "" || c.SeedAdminPassword == "" {
		return nil
	}
	u, e := r.Users.FindByEmail(ctx, c.SeedAdminEmail)
	if e != nil && !errors.Is(e, mongo.ErrNoDocuments) {
		return e
	}
	if errors.Is(e, mongo.ErrNoDocuments) {
		h, e := bcrypt.GenerateFromPassword([]byte(c.SeedAdminPassword), bcrypt.DefaultCost)
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		u = &model.User{Email: c.SeedAdminEmail, Name: "Lumina Editor", PasswordHash: string(h), Role: "admin", CreatedAt: now, UpdatedAt: now}
		if e = r.Users.Create(ctx, u); e != nil {
			return e
		}
	}
	cats, _ := r.Taxonomy.ListCategories(ctx)
	if len(cats) == 0 {
		for _, v := range []model.Category{{Name: "Design", Slug: "design", Description: "Design and visual culture"}, {Name: "Technology", Slug: "technology", Description: "Thoughtful technology"}} {
			x := v
			if e = r.Taxonomy.CreateCategory(ctx, &x); e != nil {
				return e
			}
		}
	}
	tags, _ := r.Taxonomy.ListTags(ctx)
	if len(tags) == 0 {
		for _, v := range []model.Tag{{Name: "Minimalism", Slug: "minimalism"}, {Name: "Culture", Slug: "culture"}, {Name: "Architecture", Slug: "architecture"}} {
			x := v
			if e = r.Taxonomy.CreateTag(ctx, &x); e != nil {
				return e
			}
		}
	}
	items, total, e := r.Posts.List(ctx, repository.PostFilter{})
	if e != nil {
		return e
	}
	_ = items
	if total == 0 {
		now := time.Now().UTC()
		p := &model.Post{Title: "The Architecture of Silence in the Digital Age", Slug: "architecture-of-silence", Excerpt: "Exploring the intentional voids that shape our digital experiences.", Content: "Silence is not the absence of content. It is an active material that gives shape to everything around it.", AuthorID: u.ID, Status: "public", PublishedAt: &now, CreatedAt: now, UpdatedAt: now}
		if e = r.Posts.Create(ctx, p); e != nil {
			return e
		}
	}
	log.Print("development seed data is ready")
	return nil
}
