package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
)

// AutoTaggingConfig holds the rule thresholds for automated product tagging
type AutoTaggingConfig struct {
	Enabled                     bool    `json:"enabled"`
	TimeWindowDays              int     `json:"time_window_days"`                // e.g. 14 days
	BestSellerTopN              int     `json:"best_seller_top_n"`               // e.g. Top 5 items
	BestSellerMinQty            int     `json:"best_seller_min_qty"`             // e.g. minimum 10 cups
	NewProductDays              int     `json:"new_product_days"`                // e.g. created <= 14 days
	HighProfitMarginMin         float64 `json:"high_profit_margin_min"`          // e.g. 60.0%
	HighProfitMinQty            int     `json:"high_profit_min_qty"`             // e.g. minimum 5 cups
	PrioritizeBestSellerOverNew bool    `json:"prioritize_best_seller_over_new"` // if true, best_seller wins over new
}

// DefaultAutoTaggingConfig returns standard defaults
func DefaultAutoTaggingConfig() AutoTaggingConfig {
	return AutoTaggingConfig{
		Enabled:                     false,
		TimeWindowDays:              14,
		BestSellerTopN:              5,
		BestSellerMinQty:            10,
		NewProductDays:              14,
		HighProfitMarginMin:         60.0,
		HighProfitMinQty:            5,
		PrioritizeBestSellerOverNew: true,
	}
}

// ProductEvaluation holds calculated metrics and suggested tag for an item
type ProductEvaluation struct {
	ProductID        uint    `json:"product_id"`
	ProductName      string  `json:"product_name"`
	CategoryName     string  `json:"category_name"`
	ImageURL         string  `json:"image_url"`
	TotalQty         int     `json:"total_qty"`
	TotalRevenue     float64 `json:"total_revenue"`
	TotalCogs        float64 `json:"total_cogs"`
	TotalProfit      float64 `json:"total_profit"`
	MarginPercent    float64 `json:"margin_percent"`
	SalesRank        int     `json:"sales_rank"`
	DaysSinceCreated int     `json:"days_since_created"`
	IsActive         bool    `json:"is_active"`
	CurrentTag       string  `json:"current_tag"`
	SuggestedTag     string  `json:"suggested_tag"`
	TagLocked        bool    `json:"tag_locked"`
	WillChange       bool    `json:"will_change"`
	Reason           string  `json:"reason"`
}

// AutoTaggingResult holds full evaluation output
type AutoTaggingResult struct {
	Config               AutoTaggingConfig   `json:"config"`
	EvaluatedAt          time.Time           `json:"evaluated_at"`
	TimeWindowStart      time.Time           `json:"time_window_start"`
	TimeWindowEnd        time.Time           `json:"time_window_end"`
	TotalProducts        int                 `json:"total_products"`
	ChangedProductsCount int                 `json:"changed_products_count"`
	Evaluations          []ProductEvaluation `json:"evaluations"`
}

type AutoTaggingService struct {
	db    *gorm.DB
	cache *cache.TTLCache
	mu    sync.Mutex
}

func NewAutoTaggingService(db *gorm.DB, cache *cache.TTLCache) *AutoTaggingService {
	return &AutoTaggingService{
		db:    db,
		cache: cache,
	}
}

// GetConfigForStore reads auto_tagging_config from store_settings table (or settings fallback) or returns defaults
func (s *AutoTaggingService) GetConfigForStore(storeID uint) (AutoTaggingConfig, error) {
	if storeID == 0 {
		storeID = 1
	}
	cfg := DefaultAutoTaggingConfig()

	var storeSetting models.StoreSetting
	if err := s.db.Where("store_id = ? AND key = ?", storeID, "auto_tagging_config").First(&storeSetting).Error; err == nil && storeSetting.Value != "" {
		if err := json.Unmarshal([]byte(storeSetting.Value), &cfg); err == nil {
			return cfg, nil
		}
	}

	var setting models.Setting
	if err := s.db.Where("key = ?", "auto_tagging_config").First(&setting).Error; err == nil && setting.Value != "" {
		if err := json.Unmarshal([]byte(setting.Value), &cfg); err == nil {
			return cfg, nil
		}
	}

	return cfg, nil
}

// GetConfig reads auto_tagging_config for default store #1
func (s *AutoTaggingService) GetConfig() (AutoTaggingConfig, error) {
	return s.GetConfigForStore(1)
}

// SaveConfigForStore stores configuration in store_settings table and clears cache
func (s *AutoTaggingService) SaveConfigForStore(storeID uint, cfg AutoTaggingConfig) error {
	if storeID == 0 {
		storeID = 1
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	bytes, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	val := string(bytes)

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&models.StoreSetting{
			StoreID:   storeID,
			Key:       "auto_tagging_config",
			Value:     val,
			UpdatedAt: time.Now(),
		}).Error; err != nil {
			return err
		}

		if err := tx.Save(&models.StoreSetting{
			StoreID:   storeID,
			Key:       "auto_tagging_enabled",
			Value:     fmt.Sprintf("%v", cfg.Enabled),
			UpdatedAt: time.Now(),
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return err
	}

	if s.cache != nil {
		s.cache.Invalidate(fmt.Sprintf("s%d:settings:store", storeID))
		s.cache.Invalidate(fmt.Sprintf("s%d:settings:all", storeID))
	}

	return nil
}

// SaveConfig stores configuration for default store #1
func (s *AutoTaggingService) SaveConfig(cfg AutoTaggingConfig) error {
	return s.SaveConfigForStore(1, cfg)
}

// RawQueryResult models single row from the high-speed CTE aggregation
type rawProductMetric struct {
	ProductID     uint      `gorm:"column:product_id"`
	ProductName   string    `gorm:"column:product_name"`
	CategoryName  string    `gorm:"column:category_name"`
	ImageURL      string    `gorm:"column:image_url"`
	CurrentTag    string    `gorm:"column:current_tag"`
	TagLocked     bool      `gorm:"column:tag_locked"`
	IsActive      bool      `gorm:"column:is_active"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	TotalQty      int       `gorm:"column:total_qty"`
	TotalRevenue  float64   `gorm:"column:total_revenue"`
	TotalCogs     float64   `gorm:"column:total_cogs"`
	TotalProfit   float64   `gorm:"column:total_profit"`
	MarginPercent float64   `gorm:"column:margin_percent"`
	SalesRank     int       `gorm:"column:sales_rank"`
}

// EvaluateForStore runs the single-pass CTE evaluation scoped to storeID without applying changes to DB
func (s *AutoTaggingService) EvaluateForStore(ctx context.Context, storeID uint, customCfg *AutoTaggingConfig) (*AutoTaggingResult, error) {
	if storeID == 0 {
		storeID = 1
	}
	var cfg AutoTaggingConfig
	if customCfg != nil {
		cfg = *customCfg
	} else {
		var err error
		cfg, err = s.GetConfigForStore(storeID)
		if err != nil {
			return nil, err
		}
	}

	days := cfg.TimeWindowDays
	if days <= 0 {
		days = 14
	}

	now := time.Now()
	windowStart := now.AddDate(0, 0, -days)

	// High-performance single-pass PostgreSQL CTE aggregation with Window function DENSE_RANK() scoped to storeID
	query := `
		WITH product_sales AS (
			SELECT 
				p.id AS product_id,
				p.name AS product_name,
				COALESCE(c.name, 'Chưa phân loại') AS category_name,
				COALESCE(p.image_url, '') AS image_url,
				COALESCE(p.tag, 'none') AS current_tag,
				p.tag_locked AS tag_locked,
				p.is_active AS is_active,
				p.created_at AS created_at,
				COALESCE(SUM(oi.quantity), 0)::integer AS total_qty,
				COALESCE(SUM(oi.line_total), 0)::numeric AS total_revenue,
				COALESCE(SUM(pv.cogs_price * oi.quantity), 0)::numeric AS total_cogs,
				COALESCE(SUM(oi.line_total) - SUM(pv.cogs_price * oi.quantity), 0)::numeric AS total_profit,
				CASE 
					WHEN SUM(oi.line_total) > 0 
					THEN ROUND(((SUM(oi.line_total) - SUM(pv.cogs_price * oi.quantity)) / SUM(oi.line_total) * 100)::numeric, 1)
					ELSE 0 
				END AS margin_percent,
				DENSE_RANK() OVER (ORDER BY COALESCE(SUM(oi.quantity), 0) DESC) AS sales_rank
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN product_variants pv ON pv.product_id = p.id
			LEFT JOIN order_items oi ON oi.product_variant_id = pv.id
			LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'completed' AND o.created_at >= ? AND o.store_id = ?
			WHERE p.store_id = ?
			GROUP BY p.id, p.name, c.name, p.image_url, p.tag, p.tag_locked, p.is_active, p.created_at
		)
		SELECT * FROM product_sales ORDER BY total_qty DESC, product_name ASC;
	`

	var metrics []rawProductMetric
	if err := s.db.WithContext(ctx).Raw(query, windowStart, storeID, storeID).Scan(&metrics).Error; err != nil {
		return nil, fmt.Errorf("failed to aggregate product metrics: %w", err)
	}

	evaluations := make([]ProductEvaluation, 0, len(metrics))
	changedCount := 0

	for _, m := range metrics {
		daysSinceCreated := int(math.Floor(now.Sub(m.CreatedAt).Hours() / 24))
		if daysSinceCreated < 0 {
			daysSinceCreated = 0
		}

		suggestedTag := string(models.TagNone)
		reason := "Món tiêu chuẩn (không thỏa mãn tiêu chí đặc biệt)"

		// Retain manual system tags unconditionally
		if m.CurrentTag == string(models.TagFeatured) ||
			m.CurrentTag == string(models.TagSuspended) ||
			m.CurrentTag == string(models.TagComingSoon) {
			suggestedTag = m.CurrentTag
			reason = fmt.Sprintf("Giữ nguyên tag thủ công (%s)", m.CurrentTag)
		} else if m.TagLocked {
			// Product is locked by admin — preserve whatever current tag is
			suggestedTag = m.CurrentTag
			reason = "Đã khóa tag thủ công bởi quản trị viên"
		} else {
			// Evaluate rule qualifications
			isBestSeller := m.SalesRank <= cfg.BestSellerTopN && m.TotalQty >= cfg.BestSellerMinQty && m.TotalQty > 0
			isNew := daysSinceCreated <= cfg.NewProductDays
			isHighProfit := m.MarginPercent >= cfg.HighProfitMarginMin && m.TotalQty >= cfg.HighProfitMinQty

			if cfg.PrioritizeBestSellerOverNew {
				if isBestSeller {
					suggestedTag = string(models.TagBestSeller)
					reason = fmt.Sprintf("Bán chạy (Top #%d sản lượng: %d ly trong %d ngày qua)", m.SalesRank, m.TotalQty, days)
				} else if isNew {
					suggestedTag = string(models.TagNew)
					reason = fmt.Sprintf("Món mới (Tạo cách đây %d ngày <= %d ngày)", daysSinceCreated, cfg.NewProductDays)
				} else if isHighProfit {
					suggestedTag = string(models.TagBestSeller)
					reason = fmt.Sprintf("Biên lợi nhuận cao (%.1f%% >= %.1f%%, bán %d ly)", m.MarginPercent, cfg.HighProfitMarginMin, m.TotalQty)
				}
			} else {
				if isNew {
					suggestedTag = string(models.TagNew)
					reason = fmt.Sprintf("Món mới (Tạo cách đây %d ngày <= %d ngày)", daysSinceCreated, cfg.NewProductDays)
				} else if isBestSeller {
					suggestedTag = string(models.TagBestSeller)
					reason = fmt.Sprintf("Bán chạy (Top #%d sản lượng: %d ly trong %d ngày qua)", m.SalesRank, m.TotalQty, days)
				} else if isHighProfit {
					suggestedTag = string(models.TagBestSeller)
					reason = fmt.Sprintf("Biên lợi nhuận cao (%.1f%% >= %.1f%%, bán %d ly)", m.MarginPercent, cfg.HighProfitMarginMin, m.TotalQty)
				}
			}
		}

		willChange := !m.TagLocked && m.CurrentTag != suggestedTag
		if willChange {
			changedCount++
		}

		evaluations = append(evaluations, ProductEvaluation{
			ProductID:        m.ProductID,
			ProductName:      m.ProductName,
			CategoryName:     m.CategoryName,
			ImageURL:         m.ImageURL,
			TotalQty:         m.TotalQty,
			TotalRevenue:     m.TotalRevenue,
			TotalCogs:        m.TotalCogs,
			TotalProfit:      m.TotalProfit,
			MarginPercent:    m.MarginPercent,
			SalesRank:        m.SalesRank,
			DaysSinceCreated: daysSinceCreated,
			IsActive:         m.IsActive,
			CurrentTag:       m.CurrentTag,
			SuggestedTag:     suggestedTag,
			TagLocked:        m.TagLocked,
			WillChange:       willChange,
			Reason:           reason,
		})
	}

	return &AutoTaggingResult{
		Config:               cfg,
		EvaluatedAt:          now,
		TimeWindowStart:      windowStart,
		TimeWindowEnd:        now,
		TotalProducts:        len(metrics),
		ChangedProductsCount: changedCount,
		Evaluations:          evaluations,
	}, nil
}

// Evaluate runs the evaluation for default store #1
func (s *AutoTaggingService) Evaluate(ctx context.Context, customCfg *AutoTaggingConfig) (*AutoTaggingResult, error) {
	return s.EvaluateForStore(ctx, 1, customCfg)
}

// ApplyForStore executes tag updates directly to the database for storeID
func (s *AutoTaggingService) ApplyForStore(ctx context.Context, storeID uint, targetProductIDs []uint) (*AutoTaggingResult, error) {
	if storeID == 0 {
		storeID = 1
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	result, err := s.EvaluateForStore(ctx, storeID, nil)
	if err != nil {
		return nil, err
	}

	filterSet := make(map[uint]bool)
	if len(targetProductIDs) > 0 {
		for _, id := range targetProductIDs {
			filterSet[id] = true
		}
	}

	// Transaction to update changed product tags
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, ev := range result.Evaluations {
			if !ev.WillChange || ev.TagLocked {
				continue
			}
			if len(filterSet) > 0 && !filterSet[ev.ProductID] {
				continue
			}

			if err := tx.Model(&models.Product{}).
				Where("id = ? AND store_id = ? AND tag_locked = false", ev.ProductID, storeID).
				Update("tag", ev.SuggestedTag).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to apply tag updates: %w", err)
	}

	if s.cache != nil {
		s.cache.Invalidate(fmt.Sprintf("s%d:products:list", storeID))
	}

	log.Printf("[AutoTagging] Store %d: Successfully applied tag updates for %d products", storeID, result.ChangedProductsCount)
	return result, nil
}

// Apply executes the tag updates directly to the database for default store #1
func (s *AutoTaggingService) Apply(ctx context.Context, targetProductIDs []uint) (*AutoTaggingResult, error) {
	return s.ApplyForStore(ctx, 1, targetProductIDs)
}

// ToggleLockForStore sets or unsets tag_locked for a specific product inside storeID
func (s *AutoTaggingService) ToggleLockForStore(ctx context.Context, storeID uint, productID uint, locked bool) error {
	if storeID == 0 {
		storeID = 1
	}
	if err := s.db.WithContext(ctx).Model(&models.Product{}).Where("id = ? AND store_id = ?", productID, storeID).Update("tag_locked", locked).Error; err != nil {
		return err
	}

	if s.cache != nil {
		s.cache.Invalidate(fmt.Sprintf("s%d:products:list", storeID))
	}

	return nil
}

// ToggleLock sets or unsets tag_locked for a single product (default store #1)
func (s *AutoTaggingService) ToggleLock(ctx context.Context, productID uint, locked bool) error {
	return s.ToggleLockForStore(ctx, 1, productID, locked)
}

// RunNightlyJobForStore runs automated tagging evaluation and execution for a specific store
func (s *AutoTaggingService) RunNightlyJobForStore(storeID uint) error {
	cfg, err := s.GetConfigForStore(storeID)
	if err != nil {
		return err
	}

	if !cfg.Enabled {
		log.Printf("[AutoTagging] Store %d nightly job skipped (auto_tagging_enabled = false)", storeID)
		return nil
	}

	log.Printf("[AutoTagging] Starting automated nightly product tagging for store %d...", storeID)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := s.ApplyForStore(ctx, storeID, nil)
	if err != nil {
		log.Printf("[AutoTagging] Store %d ERROR during nightly auto-tagging: %v", storeID, err)
		return err
	}

	log.Printf("[AutoTagging] Store %d nightly auto-tagging completed: %d/%d products updated.", storeID, result.ChangedProductsCount, result.TotalProducts)
	return nil
}

// RunNightlyJob runs automated tagging evaluation and execution across all active stores
func (s *AutoTaggingService) RunNightlyJob() error {
	var stores []models.Store
	if err := s.db.Where("is_active = true").Find(&stores).Error; err != nil {
		return s.RunNightlyJobForStore(1)
	}
	for _, store := range stores {
		_ = s.RunNightlyJobForStore(store.ID)
	}
	return nil
}
