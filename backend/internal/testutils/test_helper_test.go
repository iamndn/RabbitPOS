package testutils

import (
	"testing"
	"time"
)

func TestMakeMockTimestamp(t *testing.T) {
	ts := MakeMockTimestamp()
	expected := time.Date(2026, time.August, 28, 12, 0, 0, 0, time.UTC)
	if !ts.Equal(expected) {
		t.Errorf("Expected %v, got %v", expected, ts)
	}
}

func TestGetTestDB_SkipOnUnavailable(t *testing.T) {
	// Should cleanly attempt connection and skip if no Postgres DB is running
	_ = GetTestDB(t)
}
