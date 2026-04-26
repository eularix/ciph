package main

import (
	"crypto/ecdh"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

// DerivePublicKeyFromPrivate derives public key from private key (PKCS8 format)
func DerivePublicKeyFromPrivate(privKeyB64 string) (string, error) {
	privKeyBytes, err := base64.RawURLEncoding.DecodeString(privKeyB64)
	if err != nil {
		return "", fmt.Errorf("failed to decode: %w", err)
	}

	privKeyInterface, err := x509.ParsePKCS8PrivateKey(privKeyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse PKCS8: %w", err)
	}

	privKey, ok := privKeyInterface.(*ecdh.PrivateKey)
	if !ok {
		return "", fmt.Errorf("not ECDH private key")
	}

	pubKeyBytes := privKey.PublicKey().Bytes()
	return base64.RawURLEncoding.EncodeToString(pubKeyBytes), nil
}

func main() {
	goPrivKey := os.Getenv("CIPH_PRIVATE_KEY")
	if goPrivKey == "" {
		log.Fatal("CIPH_PRIVATE_KEY not set")
	}

	derivedPubKey, err := DerivePublicKeyFromPrivate(goPrivKey)
	if err != nil {
		log.Fatalf("Failed to derive public key: %v", err)
	}

	fmt.Println("=== Key Verification ===\n")
	fmt.Printf("Go private key (first 50 chars): %s...\n", goPrivKey[:min(50, len(goPrivKey))])
	fmt.Printf("Derived public key: %s\n\n", derivedPubKey)

	// Start HTTP server to let React/browser check
	http.HandleFunc("/verify", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"goPrivateKeyUsed":  goPrivKey[:20] + "...",
			"derivedPublicKey":  derivedPubKey,
			"instructions":      "Compare derivedPublicKey with VITE_CIPH_SERVER_PUBLIC_KEY in example/react/.env",
		})
	})

	fmt.Println("Verification server: http://localhost:3002/verify")
	fmt.Println("Use curl or browser to check if keys match")
	fmt.Println("Press Ctrl+C to stop")
	log.Fatal(http.ListenAndServe(":3002", nil))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
