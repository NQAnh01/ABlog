package config

import (
	"net/url"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env, Port, MongoURI, MongoDatabase, JWTSecret, StoragePath, ClientOrigin string
	AccessTTL, RefreshTTL                                                    time.Duration
	SeedAdminEmail, SeedAdminPassword                                        string
}

func Load() Config {
	return Config{
		Env: env("APP_ENV", "development"), Port: env("APP_PORT", "8080"), MongoURI: mongoURI(), MongoDatabase: env("MONGO_DATABASE", "lumina"), JWTSecret: env("JWT_SECRET", "development-only-change-me"), StoragePath: env("STORAGE_PATH", "uploads"), ClientOrigin: env("CLIENT_ORIGIN", "http://localhost:5173"), AccessTTL: duration("JWT_ACCESS_EXPIRES", 15*time.Minute), RefreshTTL: duration("JWT_REFRESH_EXPIRES", 7*24*time.Hour), SeedAdminEmail: os.Getenv("SEED_ADMIN_EMAIL"), SeedAdminPassword: os.Getenv("SEED_ADMIN_PASSWORD"),
	}
}

// mongoURI keeps database credentials in separate environment variables. The
// URL package safely escapes special characters before handing the URI to the
// MongoDB driver. If either variable is absent, MONGO_URI is used unchanged.
func mongoURI() string {
	raw := env("MONGO_URI", "mongodb://localhost:27017")
	username, password := os.Getenv("MONGO_USERNAME"), os.Getenv("MONGO_PASSWORD")
	if username == "" || password == "" {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	parsed.User = url.UserPassword(username, password)
	return parsed.String()
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func duration(k string, d time.Duration) time.Duration {
	v := os.Getenv(k)
	if v == "" {
		return d
	}
	if n, e := strconv.Atoi(v); e == nil {
		return time.Duration(n) * time.Second
	}
	if p, e := time.ParseDuration(v); e == nil {
		return p
	}
	return d
}
