package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

func updateEnvFile(filePath, key, value string) error {
	content, err := os.ReadFile(filePath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	lines := strings.Split(string(content), "\n")
	found := false

	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), key+"=") {
			lines[i] = fmt.Sprintf("%s=%s", key, value)
			found = true
			break
		}
	}

	if !found {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	result := strings.Join(lines, "\n")
	return os.WriteFile(filePath, []byte(result), 0644)
}

func main() {
	keyPair, err := core.GenerateServerKeyPair()
	if err != nil {
		log.Fatalf("Failed to generate keys: %v", err)
	}

	// Paths relative to example/go
	goEnvPath := ".env"
	reactEnvPath := filepath.Join("..", "react", ".env")

	fmt.Println("=== Ciph Key Generation ===")
	fmt.Println()

	// Update Go .env
	if err := updateEnvFile(goEnvPath, "CIPH_PRIVATE_KEY", keyPair.PrivateKey); err != nil {
		log.Fatalf("Failed to update %s: %v", goEnvPath, err)
	}
	fmt.Printf("✓ Updated %s\n", goEnvPath)

	// Update React .env
	if err := updateEnvFile(reactEnvPath, "CIPH_PUBLIC_KEY", keyPair.PublicKey); err != nil {
		log.Fatalf("Failed to update %s: %v", reactEnvPath, err)
	}
	fmt.Printf("✓ Updated %s\n", reactEnvPath)

	fmt.Println()
	fmt.Println("Keys synced automatically. Restart both servers:")
	fmt.Println("  Go:    go run cmd/main.go")
	fmt.Println("  React: npm run dev")
}
