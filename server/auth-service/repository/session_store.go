package repository

import (
	"context"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis key prefixes. RevokedTokenKeyPrefix must match the api-gateway's, which rejects these tokens.
const (
	RevokedTokenKeyPrefix = "auth:revoked:"
	loginFailKeyPrefix    = "auth:login_fail:"
)

// SessionStore keeps short-lived auth state in Redis: revoked token IDs and failed-login counters.
type SessionStore struct {
	rdb *redis.Client
}

// NewSessionStore builds a SessionStore on rdb.
func NewSessionStore(rdb *redis.Client) *SessionStore { return &SessionStore{rdb: rdb} }

// RevokeToken denylists jti until ttl elapses (the token's remaining lifetime).
func (s *SessionStore) RevokeToken(ctx context.Context, jti string, ttl time.Duration) error {
	return s.rdb.Set(ctx, RevokedTokenKeyPrefix+jti, 1, ttl).Err()
}

// LoginFailures returns the failed-login count recorded for email.
func (s *SessionStore) LoginFailures(ctx context.Context, email string) (int, error) {
	n, err := s.rdb.Get(ctx, loginFailKey(email)).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return n, err
}

// RecordLoginFailure increments the counter for email; the window restarts with each failure.
func (s *SessionStore) RecordLoginFailure(ctx context.Context, email string, window time.Duration) error {
	key := loginFailKey(email)
	_, err := s.rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Incr(ctx, key)
		p.Expire(ctx, key, window)
		return nil
	})
	return err
}

// ClearLoginFailures resets the counter after a successful login.
func (s *SessionStore) ClearLoginFailures(ctx context.Context, email string) error {
	return s.rdb.Del(ctx, loginFailKey(email)).Err()
}

func loginFailKey(email string) string { return loginFailKeyPrefix + strings.ToLower(email) }
