package main

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/xuri/excelize/v2"
)

func main() {
	now := time.Now()
	nowStr1 := now.Add(-2 * time.Hour).Format("2006-01-02 15:04")
	nowStr2 := now.Add(-1 * time.Hour).Format("2006-01-02 15:04")
	nowStr3 := now.Add(-30 * time.Minute).Format("2006-01-02 15:04")
	nowStr4 := now.Format("2006-01-02 15:04")

	headers := []string{
		"Mã Đơn Hàng (*)",
		"Thời Gian (YYYY-MM-DD HH:MM)",
		"Trạng Thái (completed/cancelled)",
		"Tên Món (*)",
		"Biến Thể / Size",
		"Số Lượng (*)",
		"Đơn Giá Món (*)",
		"Topping Đi Kèm",
		"Tiền Topping",
		"Giảm Giá Đơn",
		"Phí Ship",
		"Phụ Thu",
		"Tổng Tiền Đơn",
		"Nguồn Tiền (Tiền mặt/Chuyển khoản)",
		"Thu Ngân",
		"Ghi Chú Đơn",
	}

	sampleData := [][]string{
		{"ORD-20260821-0001", nowStr1, "completed", "Cà Phê Muối", "Size M", "2", "25000", "Trân Châu Trắng 3Q", "8000", "0", "0", "0", "58000", "Tiền mặt", "NDN", "Ít ngọt ít đá"},
		{"ORD-20260821-0002", nowStr2, "completed", "Trà Đào Cam Sả", "Size L", "1", "42000", "Thạch Đào Giòn", "8000", "5000", "0", "0", "45000", "Chuyển khoản", "NHUNG", "Khách mang về"},
		{"ORD-20260821-0003", nowStr3, "completed", "Trà Sữa Oolong Nướng", "Size L", "2", "38000", "Trân Châu Trắng 3Q, Kem Cheese Macchiato", "18000", "10000", "15000", "0", "99000", "Chuyển khoản", "DAT", "Giao qua Grab - Ít đường"},
		{"ORD-20260821-0003", nowStr3, "completed", "Bánh Croissant Bơ Tỏi", "Mặc định", "1", "28000", "", "0", "0", "0", "0", "99000", "Chuyển khoản", "DAT", "Hâm nóng bánh"},
		{"ORD-20260821-0004", nowStr4, "completed", "Sinh Tố Bơ Sáp", "Size L", "1", "48000", "", "0", "0", "0", "0", "48000", "Tiền mặt", "NDN", "Không đường chua ngọt"},
	}

	// 1. Tạo file Excel
	f := excelize.NewFile()
	sheetName := "🧾 Đơn Hàng"
	f.SetSheetName("Sheet1", sheetName)

	// Styles
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"059669"}, Pattern: 1}, // Emerald green
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "CBD5E1", Style: 1},
			{Type: "top", Color: "CBD5E1", Style: 1},
			{Type: "bottom", Color: "CBD5E1", Style: 1},
			{Type: "right", Color: "CBD5E1", Style: 1},
		},
	})

	rowStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: "Segoe UI"},
		Alignment: &excelize.Alignment{Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "E2E8F0", Style: 1},
			{Type: "top", Color: "E2E8F0", Style: 1},
			{Type: "bottom", Color: "E2E8F0", Style: 1},
			{Type: "right", Color: "E2E8F0", Style: 1},
		},
	})

	for colIdx, text := range headers {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheetName, cell, text)
	}
	f.SetRowStyle(sheetName, 1, 1, headerStyle)
	f.SetRowHeight(sheetName, 1, 30)

	for rowIdx, row := range sampleData {
		rowNum := rowIdx + 2
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowNum)
			f.SetCellValue(sheetName, cell, val)
		}
		f.SetRowStyle(sheetName, rowNum, rowNum, rowStyle)
		f.SetRowHeight(sheetName, rowNum, 22)
	}

	colWidths := map[string]float64{
		"A": 22, // Mã đơn
		"B": 24, // Thời gian
		"C": 20, // Trạng thái
		"D": 26, // Tên món
		"E": 18, // Size
		"F": 14, // Số lượng
		"G": 16, // Đơn giá
		"H": 35, // Topping
		"I": 16, // Tiền topping
		"J": 16, // Giảm giá
		"K": 14, // Phí ship
		"L": 14, // Phụ thu
		"M": 18, // Tổng tiền
		"N": 26, // Nguồn tiền
		"O": 16, // Thu ngân
		"P": 32, // Ghi chú
	}
	for col, width := range colWidths {
		f.SetColWidth(sheetName, col, col, width)
	}

	// 2. Tạo Hướng Dẫn Sheet
	guideSheet := "ℹ️ Hướng Dẫn Nhập"
	f.NewSheet(guideSheet)
	guideHeaders := []string{"Cột", "Bắt buộc?", "Quy cách & Ví dụ", "Lưu ý quan trọng"}
	for colIdx, text := range guideHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(guideSheet, cell, text)
	}
	guideHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"3B82F6"}, Pattern: 1}, // Blue
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	f.SetRowStyle(guideSheet, 1, 1, guideHeaderStyle)
	f.SetRowHeight(guideSheet, 1, 28)

	guideData := [][]string{
		{"Mã Đơn Hàng", "Bắt buộc (*)", "ORD-0001 hoặc bất kỳ chuỗi định danh duy nhất nào", "Nếu 1 đơn có nhiều món, các dòng dùng chung Mã Đơn Hàng sẽ được tự động gộp vào 1 đơn."},
		{"Thời Gian", "Tùy chọn", "YYYY-MM-DD HH:MM (VD: 2026-08-21 14:30)", "Để trống sẽ tự động lấy thời gian hiện tại lúc import."},
		{"Trạng Thái", "Tùy chọn", "completed (hoàn thành) hoặc cancelled (hủy)", "Mặc định là completed."},
		{"Tên Món", "Bắt buộc (*)", "Cà Phê Muối, Trà Sữa Oolong...", "Phải khớp với tên món đã có trong Menu hoặc hệ thống sẽ tự tìm theo tên gần đúng."},
		{"Biến Thể / Size", "Tùy chọn", "Size M, Size L, Mặc định", "Khớp với tên biến thể trong Menu."},
		{"Số Lượng", "Bắt buộc (*)", "1, 2, 3...", "Số lượng nguyên dương."},
		{"Đơn Giá Món", "Bắt buộc (*)", "25000, 35000...", "Đơn giá của 1 đơn vị món."},
		{"Topping Đi Kèm", "Tùy chọn", "Trân Châu Trắng 3Q, Thạch Đào", "Các topping cách nhau bởi dấu phẩy."},
		{"Tiền Topping", "Tùy chọn", "8000, 16000...", "Tổng tiền topping cho dòng món tương ứng."},
		{"Tổng Tiền Đơn", "Tùy chọn", "58000...", "Tổng tiền thanh toán cuối cùng của đơn hàng."},
		{"Nguồn Tiền", "Tùy chọn", "Tiền mặt / Chuyển khoản", "Khớp với Quỹ Tiền mặt hoặc Quỹ Ngân hàng (VietQR)."},
	}

	for rIdx, row := range guideData {
		rowNum := rIdx + 2
		for cIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, rowNum)
			f.SetCellValue(guideSheet, cell, val)
		}
		f.SetRowStyle(guideSheet, rowNum, rowNum, rowStyle)
		f.SetRowHeight(guideSheet, rowNum, 24)
	}
	f.SetColWidth(guideSheet, "A", "A", 20)
	f.SetColWidth(guideSheet, "B", "B", 16)
	f.SetColWidth(guideSheet, "C", "C", 40)
	f.SetColWidth(guideSheet, "D", "D", 65)

	targetPaths := []string{
		"/opt/RabbitPOS/mau_import_don_hang.xlsx",
		"/opt/RabbitPOS/frontend/public/mau_import_don_hang.xlsx",
	}

	for _, p := range targetPaths {
		_ = os.MkdirAll(filepath.Dir(p), 0755)
		if err := f.SaveAs(p); err != nil {
			fmt.Printf("Error saving %s: %v\n", p, err)
		} else {
			fmt.Printf("Saved Excel: %s\n", p)
		}
	}

	// 3. Tạo file CSV (UTF-8 BOM)
	csvData := [][]string{headers}
	csvData = append(csvData, sampleData...)

	csvPaths := []string{
		"/opt/RabbitPOS/mau_import_don_hang.csv",
		"/opt/RabbitPOS/frontend/public/mau_import_don_hang.csv",
	}

	for _, p := range csvPaths {
		_ = os.MkdirAll(filepath.Dir(p), 0755)
		file, err := os.Create(p)
		if err != nil {
			fmt.Printf("Error creating %s: %v\n", p, err)
			continue
		}
		// Write UTF-8 BOM
		_, _ = file.Write([]byte{0xEF, 0xBB, 0xBF})
		w := csv.NewWriter(file)
		_ = w.WriteAll(csvData)
		w.Flush()
		file.Close()
		fmt.Printf("Saved CSV: %s\n", p)
	}

	fmt.Println("Done generating sample import order files!")
}
