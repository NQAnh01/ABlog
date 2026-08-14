package storage

import (
	"context"
	"io"
)

type StoredObject struct {
	Key string `json:"key"`
	URL string `json:"url"`
}
type Storage interface {
	Upload(context.Context, string, io.Reader) (StoredObject, error)
	Delete(context.Context, string) error
	GetURL(string) string
}
