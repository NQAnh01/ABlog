package storage

import (
	"bytes"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"path/filepath"
	"strings"
)

// MaxDimension is the maximum width or height allowed before downscaling.
const MaxDimension = 1920

// OptimizeImage reads an image stream, checks dimensions, downscales if > 1920px,
// and encodes to optimized JPEG (quality 85) or preserves PNG if transparent.
// If decoding fails or format is unsupported, it returns the original bytes untouched.
func OptimizeImage(source io.Reader, filename string) (io.Reader, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return source, nil
	}

	data, err := io.ReadAll(source)
	if err != nil {
		return nil, err
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return bytes.NewReader(data), nil
	}

	if cfg.Width <= MaxDimension && cfg.Height <= MaxDimension && len(data) < 500*1024 {
		return bytes.NewReader(data), nil
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return bytes.NewReader(data), nil
	}

	w, h := cfg.Width, cfg.Height
	if w > MaxDimension || h > MaxDimension {
		if w > h {
			h = (h * MaxDimension) / w
			w = MaxDimension
		} else {
			w = (w * MaxDimension) / h
			h = MaxDimension
		}
		img = downscale(img, w, h)
	}

	var buf bytes.Buffer
	if format == "png" && hasTransparency(img) {
		if err := png.Encode(&buf, img); err != nil {
			return bytes.NewReader(data), nil
		}
	} else {
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
			return bytes.NewReader(data), nil
		}
	}

	return &buf, nil
}

func downscale(src image.Image, targetWidth, targetHeight int) image.Image {
	bounds := src.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	for y := 0; y < targetHeight; y++ {
		srcY := bounds.Min.Y + (y*srcHeight)/targetHeight
		for x := 0; x < targetWidth; x++ {
			srcX := bounds.Min.X + (x*srcWidth)/targetWidth
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
	return dst
}

func hasTransparency(img image.Image) bool {
	bounds := img.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y += 8 {
		for x := bounds.Min.X; x < bounds.Max.X; x += 8 {
			_, _, _, a := img.At(x, y).RGBA()
			if a < 0xffff {
				return true
			}
		}
	}
	return false
}
