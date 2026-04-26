package main

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

func main() {
	// Load env
	privKeyEnv := os.Getenv("CIPH_PRIVATE_KEY")
	if privKeyEnv == "" {
		fmt.Println("ERROR: CIPH_PRIVATE_KEY not set")
		return
	}

	fmt.Println("=== Go Backend Key Debug ===")
	fmt.Printf("CIPH_PRIVATE_KEY from env: %s\n", privKeyEnv)

	// Derive public key
	privKeyBytes, _ := base64.RawURLEncoding.DecodeString(privKeyEnv)
	fmt.Printf("Private key bytes (hex): %x\n", privKeyBytes)
	fmt.Printf("Private key length: %d bytes\n", len(privKeyBytes))

	// Now let's try to actually derive the public key
	// We'd need to use the middleware's logic
	fmt.Println("\nTo get public key, run this Go code:")
	fmt.Println("  privKey, _ := ecdh.P256().NewPrivateKey(privKeyBytes)")
	fmt.Println("  pubKeyBytes := privKey.PublicKey().Bytes()")
	fmt.Println("  pubKey := base64.RawURLEncoding.EncodeToString(pubKeyBytes)")

	// For now, just print what we need to compare
	fmt.Println("\n=== Expected public key (from React .env) ===")
	fmt.Println("Check example/react/.env for VITE_CIPH_SERVER_PUBLIC_KEY")
	fmt.Println("It MUST match the public key derived from CIPH_PRIVATE_KEY")
}
