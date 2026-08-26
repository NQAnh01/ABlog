package recommendation

import (
	"context"
	"sort"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"lumina/src/domain/model"
	"lumina/src/domain/repository"
)

const CacheTTL = 20 * time.Minute

type cacheEntry struct {
	Expires time.Time
	Posts   []model.Post
}
type Service struct {
	Posts     repository.PostRepository
	Bookmarks repository.BookmarkRepository
	Follows   repository.FollowRepository
	Series    repository.SeriesRepository
	mu        sync.RWMutex
	cache     map[string]cacheEntry
}

func ids(values []primitive.ObjectID) map[primitive.ObjectID]bool {
	result := make(map[primitive.ObjectID]bool, len(values))
	for _, value := range values {
		result[value] = true
	}
	return result
}
func overlaps(left, right []primitive.ObjectID) int {
	seen := ids(left)
	count := 0
	for _, value := range right {
		if seen[value] {
			count++
		}
	}
	return count
}

func (s *Service) ranked(ctx context.Context, userID primitive.ObjectID, recent []primitive.ObjectID) ([]model.Post, error) {
	key := "guest"
	if !userID.IsZero() {
		key = userID.Hex()
	}
	s.mu.RLock()
	cached, ok := s.cache[key]
	s.mu.RUnlock()
	if ok && time.Now().Before(cached.Expires) {
		return cached.Posts, nil
	}
	posts, _, err := s.Posts.List(ctx, repository.PostFilter{Status: "public", Page: 1, Limit: 100})
	if err != nil {
		return nil, err
	}
	authorScore := map[primitive.ObjectID]int{}
	categoryScore := map[primitive.ObjectID]int{}
	tagScore := map[primitive.ObjectID]int{}
	consumed := append([]primitive.ObjectID{}, recent...)
	if !userID.IsZero() {
		if s.Bookmarks != nil {
			values, _ := s.Bookmarks.ListPostIDs(ctx, userID)
			consumed = append(consumed, values...)
		}
		if s.Follows != nil {
			values, _ := s.Follows.ListAuthorIDs(ctx, userID)
			for _, id := range values {
				authorScore[id] += 70
			}
		}
	}
	consumedSet := ids(consumed)
	for _, post := range posts {
		weight := 0
		if consumedSet[post.ID] {
			weight += 35
		}
		for _, reaction := range post.Reactions {
			if reaction.UserID == userID {
				weight += 30
			}
		}
		if weight == 0 {
			continue
		}
		authorScore[post.AuthorID] += weight
		for _, id := range post.CategoryIDs {
			categoryScore[id] += weight
		}
		for _, id := range post.TagIDs {
			tagScore[id] += weight / 2
		}
	}
	now := time.Now()
	sort.SliceStable(posts, func(i, j int) bool {
		return score(posts[i], authorScore, categoryScore, tagScore, now) > score(posts[j], authorScore, categoryScore, tagScore, now)
	})
	s.mu.Lock()
	if s.cache == nil {
		s.cache = map[string]cacheEntry{}
	}
	s.cache[key] = cacheEntry{Expires: time.Now().Add(CacheTTL), Posts: posts}
	s.mu.Unlock()
	return posts, nil
}

func score(post model.Post, authors, categories, tags map[primitive.ObjectID]int, now time.Time) int {
	value := authors[post.AuthorID]
	for _, id := range post.CategoryIDs {
		value += categories[id]
	}
	for _, id := range post.TagIDs {
		value += tags[id]
	}
	published := post.CreatedAt
	if post.PublishedAt != nil {
		published = *post.PublishedAt
	}
	if now.Sub(published) <= 7*24*time.Hour {
		value += len(post.Reactions)*8 + 20
	}
	return value
}

func (s *Service) Recommend(ctx context.Context, userID primitive.ObjectID, current *model.Post, recent []primitive.ObjectID, limit int) ([]model.Post, error) {
	if limit < 1 || limit > 10 {
		limit = 4
	}
	ranked, err := s.ranked(ctx, userID, recent)
	if err != nil {
		return nil, err
	}
	excluded := ids(recent)
	if !userID.IsZero() && s.Bookmarks != nil {
		values, _ := s.Bookmarks.ListPostIDs(ctx, userID)
		for _, id := range values {
			excluded[id] = true
		}
	}
	if current != nil {
		excluded[current.ID] = true
	}
	seriesIDs := map[primitive.ObjectID]int{}
	if current != nil && s.Series != nil {
		if link, findErr := s.Series.FindByPost(ctx, current.ID); findErr == nil {
			if links, listErr := s.Series.ListPosts(ctx, link.SeriesID); listErr == nil {
				for index, item := range links {
					seriesIDs[item.PostID] = 1000 - index
				}
			}
		}
	}
	type candidate struct {
		post  model.Post
		score int
	}
	values := make([]candidate, 0, len(ranked))
	now := time.Now()
	for index, post := range ranked {
		if excluded[post.ID] {
			continue
		}
		value := len(ranked) - index + seriesIDs[post.ID]
		if current != nil {
			value += overlaps(post.CategoryIDs, current.CategoryIDs)*100 + overlaps(post.TagIDs, current.TagIDs)*45
			if post.AuthorID == current.AuthorID {
				value += 35
			}
		}
		published := post.CreatedAt
		if post.PublishedAt != nil {
			published = *post.PublishedAt
		}
		if now.Sub(published) <= 7*24*time.Hour {
			value += len(post.Reactions) * 5
		}
		values = append(values, candidate{post, value})
	}
	sort.SliceStable(values, func(i, j int) bool { return values[i].score > values[j].score })
	result := make([]model.Post, 0, limit)
	for _, value := range values {
		result = append(result, value.post)
		if len(result) == limit {
			break
		}
	}
	return result, nil
}
