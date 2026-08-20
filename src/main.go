package main

import (
	"context"
	"log"
	"lumina/src/api"
	"lumina/src/domain/comment"
	"lumina/src/domain/post"
	"lumina/src/domain/taxonomy"
	"lumina/src/domain/user"
	"lumina/src/infrastructure/config"
	"lumina/src/infrastructure/database/mongodb"
	"lumina/src/infrastructure/seed"
	"lumina/src/infrastructure/storage"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if err := config.LoadDotEnv(".env"); err != nil {
		log.Fatalf("load .env: %v", err)
	}
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, repos, err := mongodb.New(ctx, cfg.MongoURI, cfg.MongoDatabase)
	if err != nil {
		log.Fatalf("connect mongodb: %v", err)
	}
	defer client.Disconnect(context.Background())
	if err = seed.Run(ctx, cfg, repos); err != nil {
		log.Fatalf("seed data: %v", err)
	}
	auth := user.Service{Users: repos.Users, Sessions: repos.Sessions, Secret: []byte(cfg.JWTSecret), AccessTTL: cfg.AccessTTL, RefreshTTL: cfg.RefreshTTL}
	posts := post.Service{Repo: repos.Posts, Versions: repos.Versions}
	comments := comment.Service{Comments: repos.Comments, Posts: repos.Posts}
	taxonomies := taxonomy.Service{Repo: repos.Taxonomy}
	var objectStorage storage.Storage = storage.Local{Root: cfg.StoragePath, BaseURL: "/uploads"}
	if cfg.StorageType == "cloudinary" {
		cloudinaryStorage, storageErr := storage.NewCloudinary(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)
		if storageErr != nil {
			log.Fatalf("configure Cloudinary: %v", storageErr)
		}
		objectStorage = cloudinaryStorage
	}
	server := api.New(cfg, auth, posts, comments, taxonomies, objectStorage)
	listener, err := net.Listen("tcp4", ":"+cfg.Port)
	if err != nil {
		log.Fatalf("listen on :%s: %v", cfg.Port, err)
	}
	log.Printf("Lumina listening on :%s", cfg.Port)
	go func() {
		if err := server.App.Listener(listener); err != nil {
			log.Printf("server stopped: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, _ := context.WithTimeout(context.Background(), 5*time.Second)
	_ = server.App.ShutdownWithContext(shutdown)
}
