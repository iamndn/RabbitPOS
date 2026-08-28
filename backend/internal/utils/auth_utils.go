package utils

import (
	"errors"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type JWTClaims struct {
	UserID       uint            `json:"user_id"`
	Username     string          `json:"username"`
	Role         models.UserRole `json:"role"`
	TokenVersion int             `json:"token_version"`
	jwt.RegisteredClaims
}

// HashPassword generates a bcrypt hash for plain text password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compares plain text password against stored hash
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateJWT creates a signed JWT string containing user identity, role, token_version, and unique jti
func GenerateJWT(userID uint, username string, role models.UserRole, tokenVersion int, secret string, expiryHours int) (string, string, error) {
	if secret == "" {
		return "", "", errors.New("JWT secret cannot be empty")
	}

	jti, err := GenerateSecureToken(16)
	if err != nil {
		return "", "", err
	}

	if tokenVersion <= 0 {
		tokenVersion = 1
	}

	claims := &JWTClaims{
		UserID:       userID,
		Username:     username,
		Role:         role,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiryHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	return tokenStr, jti, nil
}

// ValidateJWT verifies signature and claims of JWT string
func ValidateJWT(tokenStr string, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
