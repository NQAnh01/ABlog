package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Local struct{ Root, BaseURL string }

func (l Local) Upload(_ context.Context, key string, r io.Reader) (StoredObject, error) {
	key = filepath.Clean(strings.TrimPrefix(key, "/"))
	if strings.HasPrefix(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid storage key")
	}
	p := filepath.Join(l.Root, key)
	if err := os.MkdirAll(filepath.Dir(p), 0750); err != nil {
		return StoredObject{}, err
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0640)
	if err != nil {
		return StoredObject{}, err
	}
	defer f.Close()
	if _, err = io.Copy(f, r); err != nil {
		return StoredObject{}, err
	}
	return StoredObject{Key: key, URL: l.GetURL(key)}, nil
}
func (l Local) Delete(_ context.Context, key string) error {
	return os.Remove(filepath.Join(l.Root, filepath.Clean(key)))
}
func (l Local) GetURL(key string) string {
	return strings.TrimRight(l.BaseURL, "/") + "/" + strings.TrimLeft(key, "/")
}
