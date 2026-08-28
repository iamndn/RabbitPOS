package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

type CatalogData struct {
	Categories map[string]int         `json:"categories"`
	Products   map[string]ProductData `json:"products"`
}

type ProductData struct {
	Category    string        `json:"category"`
	Description string        `json:"description"`
	Tag         string        `json:"tag"`
	ImageURL    string        `json:"image_url"`
	IsActive    bool          `json:"is_active"`
	Variants    []VariantData `json:"variants"`
}

type VariantData struct {
	VariantName string  `json:"variant_name"`
	SKU         string  `json:"sku"`
	CogsPrice   float64 `json:"cogs_price"`
	RetailPrice float64 `json:"retail_price"`
	IsActive    bool    `json:"is_active"`
}

// convertGoogleDriveURL converts a Google Drive view link into a direct image CDN link
func convertGoogleDriveURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}

	// Match: drive.google.com/file/d/FILE_ID/view... or ?id=FILE_ID
	re1 := regexp.MustCompile(`drive\.google\.com/file/d/([a-zA-Z0-9_-]+)`)
	if matches := re1.FindStringSubmatch(rawURL); len(matches) > 1 {
		return fmt.Sprintf("https://lh3.googleusercontent.com/d/%s", matches[1])
	}

	re2 := regexp.MustCompile(`drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)`)
	if matches := re2.FindStringSubmatch(rawURL); len(matches) > 1 {
		return fmt.Sprintf("https://lh3.googleusercontent.com/d/%s", matches[1])
	}

	re3 := regexp.MustCompile(`drive\.google\.com/uc\?.*id=([a-zA-Z0-9_-]+)`)
	if matches := re3.FindStringSubmatch(rawURL); len(matches) > 1 {
		return fmt.Sprintf("https://lh3.googleusercontent.com/d/%s", matches[1])
	}

	return rawURL
}

func main() {
	log.Println("=== Starting RabbitPOS Product Catalog Import / Overwrite ===")

	// Explicitly load .env from root
	_ = godotenv.Load("/opt/RabbitPOS/.env", ".env", "../.env")

	// Ensure DB_HOST is localhost if running on host
	_ = os.Setenv("DB_HOST", "localhost")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	// Double check host
	cfg.DBHost = "localhost"

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Read parsed catalog json
	catalogPath := "/opt/RabbitPOS/backend/data/parsed_catalog.json"
	dataBytes, err := os.ReadFile(catalogPath)
	if err != nil {
		log.Fatalf("Failed to read parsed catalog JSON: %v", err)
	}

	var catalog CatalogData
	if err := json.Unmarshal(dataBytes, &catalog); err != nil {
		log.Fatalf("Failed to parse catalog JSON: %v", err)
	}

	log.Printf("Loaded catalog: %d categories, %d products from %s", len(catalog.Categories), len(catalog.Products), catalogPath)

	err = db.Transaction(func(tx *gorm.DB) error {
		// 1. Upsert Categories
		categoryMap := make(map[string]uint) // key: UPPER(TRIM(name)) -> ID
		categoryDisplayOrders := map[string]int{
			"NGUYÊN CHẤT": 1,
			"MIX":         2,
			"CÀ PHÊ":      3,
		}

		for catName := range catalog.Categories {
			cleanCatName := strings.TrimSpace(catName)
			var cat models.Category
			res := tx.Where("LOWER(TRIM(name)) = LOWER(TRIM(?))", cleanCatName).First(&cat)
			displayOrder := categoryDisplayOrders[strings.ToUpper(cleanCatName)]
			if displayOrder == 0 {
				displayOrder = 99
			}

			if res.Error != nil {
				// Create new category
				cat = models.Category{
					Name:         cleanCatName,
					DisplayOrder: displayOrder,
					IsActive:     true,
				}
				if err := tx.Create(&cat).Error; err != nil {
					return fmt.Errorf("failed to create category %s: %w", cleanCatName, err)
				}
				log.Printf("  [+] Created Category: %s (ID: %d)", cat.Name, cat.ID)
			} else {
				// Update existing category
				cat.Name = cleanCatName
				cat.DisplayOrder = displayOrder
				cat.IsActive = true
				if err := tx.Save(&cat).Error; err != nil {
					return fmt.Errorf("failed to update category %s: %w", cleanCatName, err)
				}
				log.Printf("  [~] Updated Category: %s (ID: %d)", cat.Name, cat.ID)
			}
			categoryMap[strings.ToUpper(cleanCatName)] = cat.ID
		}

		// 2. Upsert Products & Variants
		createdProducts := 0
		updatedProducts := 0
		createdVariants := 0
		updatedVariants := 0

		for prodName, prodData := range catalog.Products {
			cleanProdName := strings.TrimSpace(prodName)
			catID := categoryMap[strings.ToUpper(strings.TrimSpace(prodData.Category))]
			if catID == 0 {
				catID = categoryMap["NGUYÊN CHẤT"]
			}

			directImageURL := convertGoogleDriveURL(prodData.ImageURL)

			var prod models.Product
			res := tx.Where("LOWER(TRIM(name)) = LOWER(TRIM(?))", cleanProdName).First(&prod)

			if res.Error != nil {
				// Create new product
				prod = models.Product{
					CategoryID:  catID,
					Name:        cleanProdName,
					Description: prodData.Description,
					Tag:         models.ProductTag(prodData.Tag),
					ImageURL:    directImageURL,
					IsActive:    prodData.IsActive,
				}
				if err := tx.Create(&prod).Error; err != nil {
					return fmt.Errorf("failed to create product %s: %w", cleanProdName, err)
				}
				createdProducts++
				log.Printf("  [+] Created Product: %s (ID: %d, Category: %s)", prod.Name, prod.ID, prodData.Category)
			} else {
				// Update existing product
				prod.CategoryID = catID
				prod.Name = cleanProdName
				if prodData.Description != "" {
					prod.Description = prodData.Description
				}
				prod.Tag = models.ProductTag(prodData.Tag)
				if directImageURL != "" {
					prod.ImageURL = directImageURL
				}
				prod.IsActive = prodData.IsActive
				if err := tx.Save(&prod).Error; err != nil {
					return fmt.Errorf("failed to update product %s: %w", cleanProdName, err)
				}
				updatedProducts++
				log.Printf("  [~] Updated Product: %s (ID: %d, Category: %s)", prod.Name, prod.ID, prodData.Category)
			}

			// Upsert variants for this product
			for _, vData := range prodData.Variants {
				cleanVarName := strings.TrimSpace(vData.VariantName)
				var variant models.ProductVariant

				vRes := tx.Where("product_id = ? AND LOWER(TRIM(variant_name)) = LOWER(TRIM(?))", prod.ID, cleanVarName).First(&variant)
				if vRes.Error != nil {
					// Create new variant
					variant = models.ProductVariant{
						ProductID:   prod.ID,
						VariantName: cleanVarName,
						CogsPrice:   vData.CogsPrice,
						RetailPrice: vData.RetailPrice,
						SKU:         vData.SKU,
						IsActive:    vData.IsActive,
					}
					if err := tx.Create(&variant).Error; err != nil {
						return fmt.Errorf("failed to create variant %s for product %s: %w", cleanVarName, prod.Name, err)
					}
					createdVariants++
					log.Printf("      [+] Created Variant: %s (COGS: %.0f, Retail: %.0f)", cleanVarName, vData.CogsPrice, vData.RetailPrice)
				} else {
					// Update existing variant prices and status
					variant.VariantName = cleanVarName
					variant.CogsPrice = vData.CogsPrice
					variant.RetailPrice = vData.RetailPrice
					if vData.SKU != "" {
						variant.SKU = vData.SKU
					}
					variant.IsActive = vData.IsActive
					if err := tx.Save(&variant).Error; err != nil {
						return fmt.Errorf("failed to update variant %s for product %s: %w", cleanVarName, prod.Name, err)
					}
					updatedVariants++
					log.Printf("      [~] Updated Variant: %s (COGS: %.0f, Retail: %.0f)", cleanVarName, vData.CogsPrice, vData.RetailPrice)
				}
			}
		}

		log.Printf("\n=== Import Summary ===")
		log.Printf("Categories: %d loaded/updated", len(categoryMap))
		log.Printf("Products: %d created, %d updated (Total: %d)", createdProducts, updatedProducts, createdProducts+updatedProducts)
		log.Printf("Variants: %d created, %d updated (Total: %d)", createdVariants, updatedVariants, createdVariants+updatedVariants)

		return nil
	})

	if err != nil {
		log.Fatalf("FATAL: Import transaction failed: %v", err)
	}

	log.Println("=== Import / Overwrite completed successfully! ===")
}
