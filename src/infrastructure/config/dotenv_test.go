package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvReplacesStaleEnvironment(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("MONGO_URI=mongodb+srv://cluster.example.net\nQUOTED=\"hello world\"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("MONGO_URI", "mongodb://mongodb:27017")
	if err := LoadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("MONGO_URI"); got != "mongodb+srv://cluster.example.net" {
		t.Fatalf("stale environment was not replaced: %q", got)
	}
	if got := os.Getenv("QUOTED"); got != "hello world" {
		t.Fatalf("quoted value was not parsed: %q", got)
	}
}
