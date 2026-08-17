package storage

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Cloudinary struct {
	CloudName string
	APIKey    string
	APISecret string
	Client    *http.Client
}

func NewCloudinary(cloudName, apiKey, apiSecret string) (*Cloudinary, error) {
	if strings.TrimSpace(cloudName) == "" || strings.TrimSpace(apiKey) == "" || strings.TrimSpace(apiSecret) == "" {
		return nil, fmt.Errorf("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required when STORAGE_TYPE=cloudinary")
	}
	return &Cloudinary{CloudName: cloudName, APIKey: apiKey, APISecret: apiSecret, Client: &http.Client{Timeout: 45 * time.Second}}, nil
}

func (c *Cloudinary) Upload(ctx context.Context, key string, source io.Reader) (StoredObject, error) {
	publicID := strings.TrimSuffix(strings.TrimLeft(strings.ReplaceAll(key, "\\", "/"), "/"), filepath.Ext(key))
	if publicID == "" || strings.HasPrefix(publicID, "../") || strings.Contains(publicID, "/../") {
		return StoredObject{}, fmt.Errorf("invalid storage key")
	}
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{"overwrite": "true", "public_id": publicID, "timestamp": timestamp}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, name := range []string{"api_key", "overwrite", "public_id", "timestamp", "signature"} {
		value := params[name]
		if name == "api_key" {
			value = c.APIKey
		}
		if name == "signature" {
			value = c.signature(params)
		}
		if err := writer.WriteField(name, value); err != nil {
			return StoredObject{}, err
		}
	}
	file, err := writer.CreateFormFile("file", path.Base(key))
	if err != nil {
		return StoredObject{}, err
	}
	if _, err = io.Copy(file, source); err != nil {
		return StoredObject{}, err
	}
	if err = writer.Close(); err != nil {
		return StoredObject{}, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("upload"), &body)
	if err != nil {
		return StoredObject{}, err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response, err := c.Client.Do(request)
	if err != nil {
		return StoredObject{}, fmt.Errorf("upload to Cloudinary: %w", err)
	}
	defer response.Body.Close()
	var result struct{ PublicID, SecureURL, Error string }
	var payload struct {
		PublicID  string `json:"public_id"`
		SecureURL string `json:"secure_url"`
		Error     struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err = json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return StoredObject{}, fmt.Errorf("decode Cloudinary response: %w", err)
	}
	result.PublicID, result.SecureURL, result.Error = payload.PublicID, payload.SecureURL, payload.Error.Message
	if response.StatusCode < 200 || response.StatusCode >= 300 || result.SecureURL == "" {
		if result.Error == "" {
			result.Error = response.Status
		}
		return StoredObject{}, fmt.Errorf("Cloudinary upload failed: %s", result.Error)
	}
	return StoredObject{Key: result.PublicID, URL: result.SecureURL}, nil
}

func (c *Cloudinary) Delete(ctx context.Context, key string) error {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{"public_id": key, "timestamp": timestamp}
	form := url.Values{"public_id": {key}, "timestamp": {timestamp}, "api_key": {c.APIKey}, "signature": {c.signature(params)}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("destroy"), strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := c.Client.Do(request)
	if err != nil {
		return fmt.Errorf("delete Cloudinary image: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("Cloudinary delete failed: %s", response.Status)
	}
	return nil
}

func (c *Cloudinary) GetURL(key string) string {
	return "https://res.cloudinary.com/" + url.PathEscape(c.CloudName) + "/image/upload/" + strings.TrimLeft(key, "/")
}

func (c *Cloudinary) endpoint(action string) string {
	return "https://api.cloudinary.com/v1_1/" + url.PathEscape(c.CloudName) + "/image/" + action
}

func (c *Cloudinary) signature(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j] < keys[j-1]; j-- {
			keys[j], keys[j-1] = keys[j-1], keys[j]
		}
	}
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+params[key])
	}
	hash := sha1.Sum([]byte(strings.Join(parts, "&") + c.APISecret))
	return hex.EncodeToString(hash[:])
}
