// Package tokens creates and checks opaque bearer tokens (guest cart
// tokens, guest order access tokens). Only SHA-256 hashes are persisted, so
// a database leak does not hand out access to carts or orders.
package tokens

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
)

// New returns a 256-bit random URL-safe token.
func New() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error
	return base64.RawURLEncoding.EncodeToString(b)
}

// Hash returns the hex SHA-256 of token. Tokens are high-entropy, so a
// plain (unsalted, fast) hash is appropriate.
func Hash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Matches reports, in constant time, whether token hashes to hash.
func Matches(hash, token string) bool {
	if hash == "" || token == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(hash), []byte(Hash(token))) == 1
}
