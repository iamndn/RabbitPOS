package cache

import (
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

// TTLCache provides a thread-safe, high-performance in-memory cache
// designed for semi-static domain entities (categories, toppings, funds, settings, products)
// to eliminate redundant PostgreSQL queries during high-concurrency peak hours.
type TTLCache struct {
	mu         sync.RWMutex
	data       map[string]cacheEntry
	defaultTTL time.Duration
	stopCh     chan struct{}
}

// NewTTLCache creates a new TTL Cache instance with a dedicated cleanup janitor goroutine
func NewTTLCache(defaultTTL time.Duration) *TTLCache {
	c := &TTLCache{
		data:       make(map[string]cacheEntry),
		defaultTTL: defaultTTL,
		stopCh:     make(chan struct{}),
	}
	go c.startJanitor()
	return c
}

// Get retrieves a cached value by key if it exists and has not expired
func (c *TTLCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	e, ok := c.data[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

// Set stores a value with the default TTL
func (c *TTLCache) Set(key string, value interface{}) {
	c.SetWithTTL(key, value, c.defaultTTL)
}

// SetWithTTL stores a value with an explicit custom TTL
func (c *TTLCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data[key] = cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
}

// Invalidate explicitly deletes a single cache key
func (c *TTLCache) Invalidate(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.data, key)
}

// InvalidatePrefix deletes all cache keys starting with the specified prefix
func (c *TTLCache) InvalidatePrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for k := range c.data {
		if strings.HasPrefix(k, prefix) {
			delete(c.data, k)
		}
	}
}

// Clear flushes all cached entries
func (c *TTLCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.data = make(map[string]cacheEntry)
}

// Close gracefully stops the background janitor goroutine
func (c *TTLCache) Close() {
	close(c.stopCh)
}

func (c *TTLCache) startJanitor() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.mu.Lock()
			now := time.Now()
			for k, e := range c.data {
				if now.After(e.expiresAt) {
					delete(c.data, k)
				}
			}
			c.mu.Unlock()
		case <-c.stopCh:
			return
		}
	}
}
