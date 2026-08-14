package config

import (
	"net/url"
	"testing"
)

func TestMongoURIInjectsAndEscapesCredentials(t *testing.T) {
	t.Setenv("MONGO_URI", "mongodb+srv://old:credentials@cluster.example.net/?appName=Lumina")
	t.Setenv("MONGO_USERNAME", "blog user")
	t.Setenv("MONGO_PASSWORD", "p@ss:/word#%")

	got, err := url.Parse(mongoURI())
	if err != nil {
		t.Fatal(err)
	}
	if got.User.Username() != "blog user" {
		t.Fatalf("username was not replaced")
	}
	password, ok := got.User.Password()
	if !ok || password != "p@ss:/word#%" {
		t.Fatalf("password was not safely preserved")
	}
}
