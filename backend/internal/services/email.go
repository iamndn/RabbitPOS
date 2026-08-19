package services

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"math"
	"net"
	"net/smtp"
	"strings"
	"time"

	"gorm.io/gorm"
)

// EmailService handles all SMTP sending and financial report generation
type EmailService struct {
	db *gorm.DB
}

// NewEmailService constructs an EmailService with a DB reference for runtime config reads
func NewEmailService(db *gorm.DB) *EmailService {
	return &EmailService{db: db}
}

// smtpConfig holds runtime SMTP credentials loaded from the settings table
type smtpConfig struct {
	Host             string
	Port             string
	User             string
	Password         string
	FromEmail        string
	FromName         string
	RecipientEmails  []string
	EnableDailyReport bool
	DailyReportTime  string
}

// loadSMTPConfig reads SMTP and report config from the settings table at runtime
// This allows users to update config via UI without restarting the server
func (s *EmailService) loadSMTPConfig() smtpConfig {
	type settingRow struct {
		Key   string
		Value string
	}
	var rows []settingRow
	s.db.Raw(`SELECT key, value FROM settings WHERE key IN (
		'smtp_host','smtp_port','smtp_user','smtp_password',
		'smtp_from_email','smtp_from_name',
		'report_recipient_emails','enable_daily_email_report','daily_report_time'
	)`).Scan(&rows)

	cfg := smtpConfig{
		Host:      "smtp.gmail.com",
		Port:      "587",
		FromName:  "Thỏ Juice & Coffee - RabbitPOS",
		DailyReportTime: "22:30",
	}

	for _, r := range rows {
		switch r.Key {
		case "smtp_host":
			cfg.Host = r.Value
		case "smtp_port":
			cfg.Port = r.Value
		case "smtp_user":
			cfg.User = r.Value
		case "smtp_password":
			cfg.Password = r.Value
		case "smtp_from_email":
			cfg.FromEmail = r.Value
		case "smtp_from_name":
			if r.Value != "" {
				cfg.FromName = r.Value
			}
		case "report_recipient_emails":
			if r.Value != "" {
				for _, email := range strings.Split(r.Value, ",") {
					trimmed := strings.TrimSpace(email)
					if trimmed != "" {
						cfg.RecipientEmails = append(cfg.RecipientEmails, trimmed)
					}
				}
			}
		case "enable_daily_email_report":
			cfg.EnableDailyReport = r.Value == "true"
		case "daily_report_time":
			if r.Value != "" {
				cfg.DailyReportTime = r.Value
			}
		}
	}
	return cfg
}

// SendEmail sends an HTML email to the specified recipients via SMTP with STARTTLS
func (s *EmailService) SendEmail(to []string, subject string, htmlBody string) error {
	cfg := s.loadSMTPConfig()

	if cfg.User == "" || cfg.Password == "" {
		return fmt.Errorf("SMTP credentials not configured: set smtp_user and smtp_password in System Settings")
	}
	if cfg.FromEmail == "" {
		cfg.FromEmail = cfg.User
	}
	if len(to) == 0 {
		return fmt.Errorf("no recipient email addresses provided")
	}

	addr := net.JoinHostPort(cfg.Host, cfg.Port)
	auth := smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)

	// Build RFC 2822 message with UTF-8 HTML body
	fromHeader := fmt.Sprintf("%s <%s>", cfg.FromName, cfg.FromEmail)
	toHeader := strings.Join(to, ", ")
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n%s",
		fromHeader, toHeader, subject, htmlBody,
	)

	// Dial with STARTTLS upgrade
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server %s: %w", addr, err)
	}

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Quit()

	// Upgrade to TLS if supported
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsCfg := &tls.Config{ServerName: cfg.Host}
		if err = client.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("STARTTLS upgrade failed: %w", err)
		}
	}

	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP authentication failed: %w", err)
	}
	if err = client.Mail(cfg.FromEmail); err != nil {
		return fmt.Errorf("SMTP MAIL FROM failed: %w", err)
	}
	for _, recipient := range to {
		if err = client.Rcpt(recipient); err != nil {
			return fmt.Errorf("SMTP RCPT TO <%s> failed: %w", recipient, err)
		}
	}
	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA command failed: %w", err)
	}
	defer wc.Close()
	if _, err = fmt.Fprint(wc, msg); err != nil {
		return fmt.Errorf("SMTP DATA write failed: %w", err)
	}

	log.Printf("[EmailService] Email sent to %d recipients: %v", len(to), to)
	return nil
}

// SendTestEmail sends a minimal test email to verify SMTP connectivity
func (s *EmailService) SendTestEmail(to string) error {
	subject := "✅ RabbitPOS - SMTP Connection Test"
	body := `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:24px;background:#f5f5f5">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
<h2 style="color:#8B5CF6;margin-top:0">🐰 RabbitPOS</h2>
<h3 style="color:#22c55e">SMTP Connection Successful!</h3>
<p style="color:#555">Your SMTP configuration is working correctly. Daily financial reports will be delivered to configured recipients.</p>
<p style="color:#888;font-size:12px">Sent from RabbitPOS System — ` + time.Now().Format("02/01/2006 15:04:05") + `</p>
</div></body></html>`
	return s.SendEmail([]string{to}, subject, body)
}

// GetDailyReportTime returns the configured daily_report_time from settings
func (s *EmailService) GetDailyReportTime() string {
	cfg := s.loadSMTPConfig()
	return cfg.DailyReportTime
}

// IsDailyReportEnabled returns whether automated daily reports are enabled
func (s *EmailService) IsDailyReportEnabled() bool {
	cfg := s.loadSMTPConfig()
	return cfg.EnableDailyReport
}

// GetDefaultRecipients returns the configured recipient email list
func (s *EmailService) GetDefaultRecipients() []string {
	cfg := s.loadSMTPConfig()
	return cfg.RecipientEmails
}

// --- Financial Data Aggregation Structs ---

type dailyRevenueSummary struct {
	TotalGrossSales  float64
	TotalDiscounts   float64
	ShippingFees     float64
	Surcharges       float64
	NetRevenue       float64
	OrderCount       int64
	AOV              float64
}

type fundCollection struct {
	FundName    string
	FundType    string
	TotalAmount float64
	OrderCount  int64
}

type expenseCategory struct {
	Category string
	Label    string
	Amount   float64
	Count    int64
}

type topProduct struct {
	ProductName  string
	VariantName  string
	QuantitySold int64
	TotalRevenue float64
}

type dailyReportData struct {
	Date             string
	StoreName        string
	Revenue          dailyRevenueSummary
	FundCollections  []fundCollection
	Expenses         []expenseCategory
	TotalExpenses    float64
	EstimatedCOGS    float64
	GrossProfit      float64
	NetProfit        float64
	TopProducts      []topProduct
	TriggeredBy      string
	GeneratedAt      string
}

// aggregateDailyData queries all financial metrics for the given date
func (s *EmailService) aggregateDailyData(date time.Time) dailyReportData {
	loc := date.Location()
	dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, loc)
	dayEnd := time.Date(date.Year(), date.Month(), date.Day(), 23, 59, 59, 999999999, loc)

	data := dailyReportData{
		Date:        date.Format("02/01/2006"),
		GeneratedAt: time.Now().Format("02/01/2006 15:04:05"),
	}

	// Read store name from settings
	var storeNameSetting struct{ Value string }
	s.db.Raw(`SELECT value FROM settings WHERE key = 'store_name'`).Scan(&storeNameSetting)
	data.StoreName = storeNameSetting.Value
	if data.StoreName == "" {
		data.StoreName = "Thỏ Juice & Coffee"
	}

	// Revenue summary from completed orders
	type revenueRow struct {
		TotalGrossSales float64
		TotalDiscounts  float64
		ShippingFees    float64
		Surcharges      float64
		NetRevenue      float64
		OrderCount      int64
	}
	var rev revenueRow
	s.db.Raw(`
		SELECT
			COALESCE(SUM(subtotal), 0)                                                          AS total_gross_sales,
			COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0)      AS total_discounts,
			COALESCE(SUM(shipping_fee), 0)                                                      AS shipping_fees,
			COALESCE(SUM(surcharge), 0)                                                         AS surcharges,
			COALESCE(SUM(total_amount), 0)                                                      AS net_revenue,
			COUNT(*)                                                                             AS order_count
		FROM orders
		WHERE status = 'completed'
		  AND created_at >= ? AND created_at <= ?
	`, dayStart, dayEnd).Scan(&rev)

	data.Revenue = dailyRevenueSummary{
		TotalGrossSales: rev.TotalGrossSales,
		TotalDiscounts:  rev.TotalDiscounts,
		ShippingFees:    rev.ShippingFees,
		Surcharges:      rev.Surcharges,
		NetRevenue:      rev.NetRevenue,
		OrderCount:      rev.OrderCount,
	}
	if rev.OrderCount > 0 {
		data.Revenue.AOV = math.Round(rev.NetRevenue/float64(rev.OrderCount)*100) / 100
	}

	// Fund collection breakdown (payment methods)
	type fundRow struct {
		FundName    string
		FundType    string
		TotalAmount float64
		OrderCount  int64
	}
	var fundRows []fundRow
	s.db.Raw(`
		SELECT
			f.name      AS fund_name,
			f.fund_type AS fund_type,
			COALESCE(SUM(o.total_amount), 0) AS total_amount,
			COUNT(o.id) AS order_count
		FROM orders o
		JOIN funds f ON f.id = o.fund_id
		WHERE o.status = 'completed'
		  AND o.created_at >= ? AND o.created_at <= ?
		GROUP BY f.id, f.name, f.fund_type
		ORDER BY total_amount DESC
	`, dayStart, dayEnd).Scan(&fundRows)
	for _, fr := range fundRows {
		data.FundCollections = append(data.FundCollections, fundCollection{
			FundName:    fr.FundName,
			FundType:    fr.FundType,
			TotalAmount: fr.TotalAmount,
			OrderCount:  fr.OrderCount,
		})
	}

	// Expense breakdown by category (outflow transactions)
	type expenseRow struct {
		Category string
		Amount   float64
		Count    int64
	}
	var expenseRows []expenseRow
	s.db.Raw(`
		SELECT
			category,
			COALESCE(SUM(amount), 0) AS amount,
			COUNT(*) AS count
		FROM transactions
		WHERE transaction_type = 'outflow'
		  AND category != 'sale'
		  AND created_at >= ? AND created_at <= ?
		GROUP BY category
		ORDER BY amount DESC
	`, dayStart, dayEnd).Scan(&expenseRows)

	// Human-readable category labels
	categoryLabels := map[string]string{
		"ingredient_purchase":       "Nguyên vật liệu",
		"utility_bill":              "Chi phí tiện ích",
		"reconciliation_variance":   "Chênh lệch kiểm kê",
		"salary":                    "Lương nhân viên",
		"packaging":                 "Vật tư đóng gói",
		"equipment":                 "Thiết bị & dụng cụ",
		"marketing":                 "Marketing & quảng cáo",
		"other":                     "Chi phí khác",
	}
	for _, er := range expenseRows {
		label, ok := categoryLabels[er.Category]
		if !ok {
			label = er.Category
		}
		data.Expenses = append(data.Expenses, expenseCategory{
			Category: er.Category,
			Label:    label,
			Amount:   er.Amount,
			Count:    er.Count,
		})
		data.TotalExpenses += er.Amount
	}

	// Estimated COGS from order items
	var cogsRow struct{ TotalCogs float64 }
	s.db.Raw(`
		SELECT COALESCE(SUM(oi.quantity * pv.cogs_price), 0) AS total_cogs
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN product_variants pv ON pv.id = oi.product_variant_id
		WHERE o.status = 'completed'
		  AND o.created_at >= ? AND o.created_at <= ?
	`, dayStart, dayEnd).Scan(&cogsRow)
	data.EstimatedCOGS = cogsRow.TotalCogs
	data.GrossProfit = data.Revenue.NetRevenue - data.EstimatedCOGS
	data.NetProfit = data.GrossProfit - data.TotalExpenses

	// Top 5 best-selling products by revenue
	type topRow struct {
		ProductName  string
		VariantName  string
		QuantitySold int64
		TotalRevenue float64
	}
	var topRows []topRow
	s.db.Raw(`
		SELECT
			p.name                                    AS product_name,
			pv.variant_name                           AS variant_name,
			COALESCE(SUM(oi.quantity), 0)             AS quantity_sold,
			COALESCE(SUM(oi.line_total), 0)           AS total_revenue
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN product_variants pv ON pv.id = oi.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE o.status = 'completed'
		  AND o.created_at >= ? AND o.created_at <= ?
		GROUP BY p.id, p.name, pv.id, pv.variant_name
		ORDER BY total_revenue DESC
		LIMIT 5
	`, dayStart, dayEnd).Scan(&topRows)
	for _, tr := range topRows {
		data.TopProducts = append(data.TopProducts, topProduct{
			ProductName:  tr.ProductName,
			VariantName:  tr.VariantName,
			QuantitySold: tr.QuantitySold,
			TotalRevenue: tr.TotalRevenue,
		})
	}

	return data
}

// formatVND formats a float64 as Vietnamese currency string
func formatVND(amount float64) string {
	isNeg := amount < 0
	abs := amount
	if isNeg {
		abs = -amount
	}
	intPart := int64(abs)
	s := fmt.Sprintf("%d", intPart)
	// Insert thousand separators
	result := ""
	for i, c := range reverseString(s) {
		if i > 0 && i%3 == 0 {
			result = "." + result
		}
		result = string(c) + result
	}
	if isNeg {
		return "-" + result + "đ"
	}
	return result + "đ"
}

func reverseString(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// profitColor returns green or red CSS color based on sign
func profitColor(amount float64) string {
	if amount >= 0 {
		return "#22c55e"
	}
	return "#ef4444"
}

// buildHTMLReport compiles the financial data into a mobile-responsive HTML email
func buildHTMLReport(data dailyReportData) (string, error) {
	const emailTpl = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo Cáo Tài Chính Ngày {{.Date}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- HEADER BANNER -->
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);border-radius:16px 16px 0 0;padding:32px 32px 24px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🐰</div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:0.5px;">{{.StoreName}}</h1>
          <p style="margin:8px 0 0;color:#c4b5fd;font-size:13px;">Báo cáo tài chính cuối ngày</p>
          <p style="margin:4px 0 0;color:#e0e7ff;font-size:20px;font-weight:600;">📅 {{.Date}}</p>
          {{if .TriggeredBy}}<p style="margin:8px 0 0;color:#c4b5fd;font-size:11px;">Kích hoạt bởi: {{.TriggeredBy}}</p>{{end}}
        </td>
      </tr>

      <!-- KPI GRID -->
      <tr>
        <td style="background:#fff;padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:4px solid #7c3aed;">
            <tr>
              <td width="50%" style="padding:20px 12px;text-align:center;border-right:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">💰 Doanh Thu</div>
                <div style="font-size:22px;font-weight:700;color:#7c3aed;">{{formatVND .Revenue.NetRevenue}}</div>
              </td>
              <td width="50%" style="padding:20px 12px;text-align:center;border-bottom:1px solid #f0f0f0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🛒 Đơn Hàng</div>
                <div style="font-size:22px;font-weight:700;color:#0ea5e9;">{{.Revenue.OrderCount}}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:20px 12px;text-align:center;border-right:1px solid #f0f0f0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">📊 AOV / Đơn</div>
                <div style="font-size:22px;font-weight:700;color:#f59e0b;">{{formatVND .Revenue.AOV}}</div>
              </td>
              <td width="50%" style="padding:20px 12px;text-align:center;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">💎 Lợi Nhuận</div>
                <div style="font-size:22px;font-weight:700;color:{{profitColor .NetProfit}};">{{formatVND .NetProfit}}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- REVENUE BREAKDOWN -->
      <tr>
        <td style="background:#fff;padding:4px 24px 20px;">
          <h3 style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 10px;padding-left:4px;border-left:3px solid #7c3aed;">📈 Chi Tiết Doanh Thu</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr><td style="padding:6px 8px;color:#555;">Doanh thu gộp (subtotal)</td><td align="right" style="padding:6px 8px;font-weight:600;color:#1f2937;">{{formatVND .Revenue.TotalGrossSales}}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:6px 8px;color:#555;">(-) Giảm giá &amp; khuyến mãi</td><td align="right" style="padding:6px 8px;color:#ef4444;">-{{formatVND .Revenue.TotalDiscounts}}</td></tr>
            <tr><td style="padding:6px 8px;color:#555;">(+) Phí giao hàng</td><td align="right" style="padding:6px 8px;color:#22c55e;">+{{formatVND .Revenue.ShippingFees}}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:6px 8px;color:#555;">(+) Phụ thu</td><td align="right" style="padding:6px 8px;color:#22c55e;">+{{formatVND .Revenue.Surcharges}}</td></tr>
            <tr style="border-top:2px solid #7c3aed;"><td style="padding:8px 8px;color:#7c3aed;font-weight:700;">= Doanh thu thuần</td><td align="right" style="padding:8px 8px;font-weight:700;color:#7c3aed;">{{formatVND .Revenue.NetRevenue}}</td></tr>
          </table>
        </td>
      </tr>

      <!-- PAYMENT COLLECTIONS -->
      {{if .FundCollections}}
      <tr>
        <td style="background:#fff;padding:4px 24px 20px;">
          <h3 style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 10px;padding-left:4px;border-left:3px solid #0ea5e9;">💳 Thu Theo Phương Thức Thanh Toán</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr style="background:#f0f9ff;">
              <th style="padding:8px;text-align:left;color:#0369a1;font-size:11px;text-transform:uppercase;">Quỹ / Nguồn thu</th>
              <th style="padding:8px;text-align:center;color:#0369a1;font-size:11px;text-transform:uppercase;">Đơn</th>
              <th style="padding:8px;text-align:right;color:#0369a1;font-size:11px;text-transform:uppercase;">Tổng thu</th>
            </tr>
            {{range .FundCollections}}
            <tr>
              <td style="padding:7px 8px;color:#374151;">{{.FundName}}</td>
              <td style="padding:7px 8px;text-align:center;color:#555;">{{.OrderCount}}</td>
              <td style="padding:7px 8px;text-align:right;font-weight:600;color:#1f2937;">{{formatVND .TotalAmount}}</td>
            </tr>
            {{end}}
          </table>
        </td>
      </tr>
      {{end}}

      <!-- EXPENSE BREAKDOWN -->
      {{if .Expenses}}
      <tr>
        <td style="background:#fff;padding:4px 24px 20px;">
          <h3 style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 10px;padding-left:4px;border-left:3px solid #ef4444;">💸 Chi Phí Vận Hành</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            {{range .Expenses}}
            <tr>
              <td style="padding:6px 8px;color:#555;">{{.Label}}</td>
              <td style="padding:6px 8px;text-align:center;color:#9ca3af;font-size:11px;">×{{.Count}}</td>
              <td style="padding:6px 8px;text-align:right;color:#ef4444;">-{{formatVND .Amount}}</td>
            </tr>
            {{end}}
            <tr style="border-top:2px solid #ef4444;">
              <td colspan="2" style="padding:8px;color:#dc2626;font-weight:700;">Tổng chi phí</td>
              <td style="padding:8px;text-align:right;color:#dc2626;font-weight:700;">-{{formatVND .TotalExpenses}}</td>
            </tr>
          </table>
        </td>
      </tr>
      {{end}}

      <!-- P&L SUMMARY -->
      <tr>
        <td style="background:#fff;padding:4px 24px 20px;">
          <h3 style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 10px;padding-left:4px;border-left:3px solid #f59e0b;">📊 Tổng Kết Lợi Nhuận</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr><td style="padding:6px 8px;color:#555;">Doanh thu thuần</td><td align="right" style="padding:6px 8px;color:#7c3aed;font-weight:600;">{{formatVND .Revenue.NetRevenue}}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:6px 8px;color:#555;">(-) Ước tính giá vốn (COGS)</td><td align="right" style="padding:6px 8px;color:#ef4444;">-{{formatVND .EstimatedCOGS}}</td></tr>
            <tr><td style="padding:6px 8px;color:#555;">= Lợi nhuận gộp</td><td align="right" style="padding:6px 8px;color:#22c55e;font-weight:600;">{{formatVND .GrossProfit}}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:6px 8px;color:#555;">(-) Chi phí vận hành</td><td align="right" style="padding:6px 8px;color:#ef4444;">-{{formatVND .TotalExpenses}}</td></tr>
            <tr style="border-top:2px solid #374151;">
              <td style="padding:10px 8px;color:#1f2937;font-weight:700;font-size:15px;">💎 Lợi nhuận ròng</td>
              <td align="right" style="padding:10px 8px;font-weight:700;font-size:15px;color:{{profitColor .NetProfit}};">{{formatVND .NetProfit}}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- TOP PRODUCTS -->
      {{if .TopProducts}}
      <tr>
        <td style="background:#fff;padding:4px 24px 20px;">
          <h3 style="color:#374151;font-size:14px;font-weight:600;margin:16px 0 10px;padding-left:4px;border-left:3px solid #22c55e;">🏆 Top 5 Sản Phẩm Bán Chạy</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
            <tr style="background:#f0fdf4;">
              <th style="padding:8px;text-align:left;color:#15803d;font-size:11px;text-transform:uppercase;">#</th>
              <th style="padding:8px;text-align:left;color:#15803d;font-size:11px;text-transform:uppercase;">Sản phẩm</th>
              <th style="padding:8px;text-align:center;color:#15803d;font-size:11px;text-transform:uppercase;">SL</th>
              <th style="padding:8px;text-align:right;color:#15803d;font-size:11px;text-transform:uppercase;">Doanh thu</th>
            </tr>
            {{range $i, $p := .TopProducts}}
            <tr {{if isEven $i}}style="background:#fafafa;"{{end}}>
              <td style="padding:7px 8px;color:#9ca3af;font-weight:600;">{{add $i 1}}</td>
              <td style="padding:7px 8px;color:#374151;">{{$p.ProductName}} <span style="color:#9ca3af;font-size:11px;">({{$p.VariantName}})</span></td>
              <td style="padding:7px 8px;text-align:center;color:#555;">{{$p.QuantitySold}}</td>
              <td style="padding:7px 8px;text-align:right;color:#15803d;font-weight:600;">{{formatVND $p.TotalRevenue}}</td>
            </tr>
            {{end}}
          </table>
        </td>
      </tr>
      {{end}}

      <!-- FOOTER -->
      <tr>
        <td style="background:#1f2937;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">🐰 {{.StoreName}} — RabbitPOS</p>
          <p style="margin:6px 0 0;color:#6b7280;font-size:10px;">Báo cáo được tạo lúc: {{.GeneratedAt}}</p>
          <p style="margin:6px 0 0;color:#6b7280;font-size:10px;">Email này được gửi tự động từ hệ thống RabbitPOS. Vui lòng không trả lời.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

	funcMap := template.FuncMap{
		"formatVND":   formatVND,
		"profitColor": profitColor,
		"isEven":      func(i int) bool { return i%2 == 0 },
		"add":         func(a, b int) int { return a + b },
	}
	tmpl, err := template.New("report").Funcs(funcMap).Parse(emailTpl)
	if err != nil {
		return "", fmt.Errorf("failed to parse email template: %w", err)
	}

	var buf bytes.Buffer
	if err = tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to render email template: %w", err)
	}
	return buf.String(), nil
}

// SendDailyFinancialReport aggregates financial data for the given date and sends it to all recipients
// triggeredBy is the username of the person who triggered it (empty for automated sends)
func (s *EmailService) SendDailyFinancialReport(date time.Time, triggeredBy string, overrideRecipients []string) error {
	cfg := s.loadSMTPConfig()

	recipients := overrideRecipients
	if len(recipients) == 0 {
		recipients = cfg.RecipientEmails
	}
	if len(recipients) == 0 {
		return fmt.Errorf("no recipient emails configured for daily report")
	}

	data := s.aggregateDailyData(date)
	data.TriggeredBy = triggeredBy

	htmlBody, err := buildHTMLReport(data)
	if err != nil {
		return fmt.Errorf("failed to build report HTML: %w", err)
	}

	subject := fmt.Sprintf("📊 Báo Cáo Tài Chính Ngày %s — %s", date.Format("02/01/2006"), data.StoreName)
	return s.SendEmail(recipients, subject, htmlBody)
}
