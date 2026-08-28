package middleware

import (
	"testing"
	"time"
)

func TestRateLimiter_AllowedWithinLimit(t *testing.T) {
	limiter := NewMemoryRateLimiter(5, 1*time.Minute)
	key := "ip:192.168.1.100"

	for i := 0; i < 5; i++ {
		if !limiter.IsAllowed(key) {
			t.Errorf("Attempt %d should be allowed within quota", i+1)
		}
		limiter.RecordFailure(key)
	}
}

func TestRateLimiter_BlockedAfterLimit(t *testing.T) {
	limiter := NewMemoryRateLimiter(3, 1*time.Minute)
	key := "user:admin"

	// Record 3 failures
	limiter.RecordFailure(key)
	limiter.RecordFailure(key)
	limiter.RecordFailure(key)

	// 4th attempt should be blocked
	if limiter.IsAllowed(key) {
		t.Errorf("4th attempt should be blocked after exceeding limit of 3")
	}
}

func TestRateLimiter_ResetOnSuccess(t *testing.T) {
	limiter := NewMemoryRateLimiter(2, 1*time.Minute)
	key := "ip:10.0.0.5"

	limiter.RecordFailure(key)
	limiter.RecordFailure(key)

	if limiter.IsAllowed(key) {
		t.Errorf("Should be blocked after 2 failures")
	}

	// Successful login resets limiter
	limiter.Reset(key)

	if !limiter.IsAllowed(key) {
		t.Errorf("Should be allowed after reset")
	}
}
