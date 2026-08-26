import ExcelJS from 'exceljs';
import { SettingsMap } from './utils';

/**
 * Downloads a generated Excel workbook in browser
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * 1. Export Transactions (Sổ Thu Chi) to Styled Excel (.xlsx)
 */
export async function exportTransactionsToExcel(
  transactions: any[],
  settings?: SettingsMap | null,
  filename?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RabbitPOS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Sổ Thu Chi', {
    views: [{ showGridLines: true }],
  });

  const storeName = settings?.store_name || 'Thỏ Juice & Coffee';
  const storePhone = settings?.store_phone || '';
  const storeAddress = settings?.store_address || '';

  // 1. Header Information Block
  worksheet.mergeCells('A1:I1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = `${storeName.toUpperCase()} - BÁO CÁO SỔ THU CHI & DÒNG TIỀN`;
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1B365D' } };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells('A2:I2');
  const subTitleRow = worksheet.getCell('A2');
  subTitleRow.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Địa chỉ: ${storeAddress} ${storePhone ? `· SĐT: ${storePhone}` : ''}`;
  subTitleRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
  subTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  // Empty row for spacing
  worksheet.addRow([]);

  // 2. Table Column Headers
  const headers = [
    'MÃ GIAO DỊCH',
    'THỜI GIAN',
    'THU NGÂN',
    'QUỸ THANH TOÁN',
    'LOẠI GD',
    'DANH MỤC',
    'SỐ TIỀN (VND)',
    'ĐƠN HÀNG',
    'MÔ TẢ GIAO DỊCH',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B365D' }, // Navy Blue
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF111111' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });

  const startDataRow = 5;

  // 3. Data Rows
  transactions.forEach((tx) => {
    const isIncome = tx.transaction_type === 'inflow';
    const amountVal = Number(tx.amount) || 0;
    const isCancelled = tx.reference_order?.status === 'cancelled';

    const row = worksheet.addRow([
      `#${tx.id}`,
      tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN') : '—',
      tx.cashier_name || tx.created_by || 'Hệ thống',
      tx.fund?.name || 'Tiền mặt',
      isIncome ? 'Thu (+)' : 'Chi (-)',
      tx.category || 'Khác',
      amountVal,
      tx.reference_order?.order_code ? `#${tx.reference_order.order_code}${isCancelled ? ' (Đã hủy)' : ''}` : '—',
      tx.description || '',
    ]);

    row.height = 22;

    // Formatting individual cells
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    // Type badge color
    const typeCell = row.getCell(5);
    typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    typeCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isIncome ? 'FF047857' : 'FFB91C1C' },
    };

    row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };

    // Amount column format
    const amountCell = row.getCell(7);
    amountCell.numFmt = '#,##0 "đ"';
    amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
    amountCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isIncome ? 'FF047857' : 'FFB91C1C' },
    };

    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };

    // Row borders
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  const endDataRow = startDataRow + transactions.length - 1;

  // 4. Summary Formulas Row
  if (transactions.length > 0) {
    const summaryRow = worksheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      `${transactions.length} giao dịch`,
      { formula: `SUMIF(E${startDataRow}:E${endDataRow}, "Thu (+)", G${startDataRow}:G${endDataRow}) - SUMIF(E${startDataRow}:E${endDataRow}, "Chi (-)", G${startDataRow}:G${endDataRow})` },
      '',
      'Dòng tiền ròng (Tổng Thu - Tổng Chi)',
    ]);

    summaryRow.height = 26;
    worksheet.mergeCells(`A${summaryRow.number}:E${summaryRow.number}`);

    summaryRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF111827' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } },
      };
    });

    const sumAmountCell = summaryRow.getCell(7);
    sumAmountCell.numFmt = '#,##0 "đ"';
    sumAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  // 5. Auto Column Widths
  worksheet.columns = [
    { width: 15 }, // Mã GD
    { width: 20 }, // Thời gian
    { width: 18 }, // Thu ngân
    { width: 18 }, // Quỹ
    { width: 12 }, // Loại
    { width: 28 }, // Danh mục
    { width: 20 }, // Số tiền
    { width: 18 }, // Đơn hàng
    { width: 35 }, // Mô tả
  ];

  const nowStr = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(workbook, filename || `So_Thu_Chi_${nowStr}.xlsx`);
}

/**
 * 2. Export Orders (Lịch Sử Đơn Hàng) to Styled Excel (.xlsx)
 */
export async function exportOrdersToExcel(
  orders: any[],
  settings?: SettingsMap | null,
  filename?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RabbitPOS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Lịch Sử Đơn Hàng', {
    views: [{ showGridLines: true }],
  });

  const storeName = settings?.store_name || 'Thỏ Juice & Coffee';
  const storePhone = settings?.store_phone || '';
  const storeAddress = settings?.store_address || '';

  // 1. Header Info
  worksheet.mergeCells('A1:J1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = `${storeName.toUpperCase()} - BÁO CÁO LỊCH SỬ ĐƠN HÀNG`;
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF065F46' } }; // Dark Emerald
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells('A2:J2');
  const subTitleRow = worksheet.getCell('A2');
  subTitleRow.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Địa chỉ: ${storeAddress} ${storePhone ? `· SĐT: ${storePhone}` : ''}`;
  subTitleRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
  subTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  worksheet.addRow([]);

  // 2. Column Headers
  const headers = [
    'MÃ ĐƠN HÀNG',
    'THỜI GIAN',
    'THU NGÂN',
    'QUỸ THANH TOÁN',
    'CHI TIẾT MÓN',
    'TẠM TÍNH',
    'GIẢM GIÁ / KM',
    'PHỤ THU / SHIP',
    'TỔNG TIỀN (VND)',
    'TRẠNG THÁI',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF065F46' }, // Dark Emerald
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF111111' } },
    };
  });

  const startDataRow = 5;

  // 3. Data Rows
  orders.forEach((order) => {
    const isCompleted = order.status === 'completed';
    const isCancelled = order.status === 'cancelled';

    const itemsSummary = (order.items || [])
      .map((it: any) => `${it.quantity}x ${it.variant?.product?.name || it.variant?.variant_name || 'Món'}`)
      .join(', ');

    const totalDiscount = (Number(order.discount_amount) || 0) + (Number(order.promotion_discount) || 0) + (Number(order.platform_fee_discount) || 0);
    const totalExtra = (Number(order.shipping_fee) || 0) + (Number(order.surcharge) || 0);

    const row = worksheet.addRow([
      `#${order.order_code}`,
      order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '—',
      order.cashier_name || order.created_by || 'Thu ngân',
      order.fund?.name || 'Tiền mặt',
      itemsSummary || '—',
      Number(order.subtotal) || 0,
      totalDiscount,
      totalExtra,
      Number(order.total_amount) || 0,
      isCancelled ? 'Đã hủy' : isCompleted ? 'Hoàn thành' : 'Đang xử lý',
    ]);

    row.height = 22;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

    // Money columns
    [6, 7, 8, 9].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.numFmt = '#,##0 "đ"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const totalCell = row.getCell(9);
    totalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: isCancelled ? 'FF9CA3AF' : 'FF065F46' } };

    const statusCell = row.getCell(10);
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statusCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: isCancelled ? 'FFB91C1C' : isCompleted ? 'FF047857' : 'FFD97706' },
    };

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  const endDataRow = startDataRow + orders.length - 1;

  // 4. Summary Row
  if (orders.length > 0) {
    const summaryRow = worksheet.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      `${orders.length} đơn hàng`,
      { formula: `SUM(F${startDataRow}:F${endDataRow})` },
      { formula: `SUM(G${startDataRow}:G${endDataRow})` },
      { formula: `SUM(H${startDataRow}:H${endDataRow})` },
      { formula: `SUMIF(J${startDataRow}:J${endDataRow}, "Hoàn thành", I${startDataRow}:I${endDataRow})` },
      'Chỉ tính đơn hoàn thành',
    ]);

    summaryRow.height = 26;
    worksheet.mergeCells(`A${summaryRow.number}:D${summaryRow.number}`);

    summaryRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF111827' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } },
      };
    });

    [6, 7, 8, 9].forEach((colIdx) => {
      const cell = summaryRow.getCell(colIdx);
      cell.numFmt = '#,##0 "đ"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
  }

  // 5. Widths
  worksheet.columns = [
    { width: 16 }, // Mã đơn
    { width: 20 }, // Thời gian
    { width: 18 }, // Thu ngân
    { width: 16 }, // Quỹ
    { width: 35 }, // Món
    { width: 16 }, // Tạm tính
    { width: 16 }, // Giảm giá
    { width: 16 }, // Phụ phí
    { width: 20 }, // Tổng tiền
    { width: 16 }, // Trạng thái
  ];

  const nowStr = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(workbook, filename || `Don_Hang_${nowStr}.xlsx`);
}

/**
 * 3. Export Product Sales Performance / Ranking to Styled Excel (.xlsx)
 */
export async function exportProductsRankingToExcel(
  items: any[],
  settings?: SettingsMap | null,
  filename?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RabbitPOS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Xếp Hạng Sản Phẩm', {
    views: [{ showGridLines: true }],
  });

  const storeName = settings?.store_name || 'Thỏ Juice & Coffee';

  worksheet.mergeCells('A1:I1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = `${storeName.toUpperCase()} - BÁO CÁO XẾP HẠNG & HIỆU SUẤT SẢN PHẨM`;
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF4338CA' } }; // Indigo
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells('A2:I2');
  const subTitleRow = worksheet.getCell('A2');
  subTitleRow.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`;
  subTitleRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
  subTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  worksheet.addRow([]);

  const headers = [
    'HẠNG',
    'TÊN SẢN PHẨM',
    'DANH MỤC',
    'SỐ LƯỢNG BÁN',
    'DOANH THU (VND)',
    'GIÁ VỐN COGS (VND)',
    'LỢI NHUẬN GỘP (VND)',
    'BIÊN LỢI NHUẬN',
    'TỶ TRỌNG DOANH THU',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' }, // Indigo
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const startDataRow = 5;

  items.forEach((item, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      item.product_name,
      item.category_name || 'Khác',
      Number(item.quantity_sold) || 0,
      Number(item.total_revenue) || 0,
      Number(item.total_cogs) || 0,
      Number(item.total_profit) || 0,
      `${item.margin_percentage ?? 0}%`,
      `${item.revenue_share_percentage ?? 0}%`,
    ]);

    row.height = 22;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    [5, 6, 7].forEach((colIdx) => {
      const cell = row.getCell(colIdx);
      cell.numFmt = '#,##0 "đ"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  const endDataRow = startDataRow + items.length - 1;

  if (items.length > 0) {
    const summaryRow = worksheet.addRow([
      'TỔNG CỘNG',
      '',
      `${items.length} món`,
      { formula: `SUM(D${startDataRow}:D${endDataRow})` },
      { formula: `SUM(E${startDataRow}:E${endDataRow})` },
      { formula: `SUM(F${startDataRow}:F${endDataRow})` },
      { formula: `SUM(G${startDataRow}:G${endDataRow})` },
      '',
      '100%',
    ]);

    summaryRow.height = 26;
    worksheet.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);

    summaryRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF111827' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } },
      };
    });

    [5, 6, 7].forEach((colIdx) => {
      const cell = summaryRow.getCell(colIdx);
      cell.numFmt = '#,##0 "đ"';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
  }

  worksheet.columns = [
    { width: 10 }, // Hạng
    { width: 30 }, // Tên món
    { width: 20 }, // Danh mục
    { width: 16 }, // SL bán
    { width: 22 }, // Doanh thu
    { width: 22 }, // Giá vốn
    { width: 22 }, // Lợi nhuận
    { width: 18 }, // Biên LN
    { width: 20 }, // Tỷ trọng
  ];

  const nowStr = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(workbook, filename || `Xep_Hang_SanPham_${nowStr}.xlsx`);
}
