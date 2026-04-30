// ─────────────────────────────────────────────
//  constants.js  (UPDATED)
//  Added IMPORT_STOCK route
// ─────────────────────────────────────────────

export const EXCEL_FILE_NAME = 'keva_stock.xlsx';

export const TOTAL_STOCK_SHEET = 'Total Stock';

export const COL_PRODUCT_NAME   = 0;
export const COL_TOTAL_STOCK_IN = 1;
export const COL_TOTAL_SOLD     = 2;
export const COL_CURRENT_STOCK  = 3;
export const COL_LAST_UPDATED   = 4;

export const TOTAL_STOCK_HEADERS = [
  'Product Name',
  'Total Stock In',
  'Total Sold',
  'Current Stock',
  'Last Updated',
];

export const PROD_COL_DATETIME = 0;
export const PROD_COL_TYPE     = 1;
export const PROD_COL_CUSTOMER = 2;
export const PROD_COL_QTY      = 3;

export const PRODUCT_SHEET_HEADERS = [
  'Date & Time',
  'Entry Type',
  'Customer / Source',
  'Quantity',
];

export const ENTRY_TYPE = {
  OPENING_STOCK: 'OPENING STOCK',
  SALE:          'SALE',
  STOCK_IN:      'STOCK IN',
};

export const LOW_STOCK_THRESHOLD   = 5;
export const MAX_SHEET_NAME_LENGTH = 31;
export const MIN_PRODUCT_NAME_LEN  = 2;
export const MIN_CUSTOMER_NAME_LEN = 2;

export const COLORS = {
  primary:      '#1565C0',
  primaryDark:  '#003c8f',
  primaryLight: '#5e92f3',
  accent:       '#FF6F00',
  success:      '#2E7D32',
  error:        '#C62828',
  warning:      '#F9A825',
  surface:      '#FFFFFF',
  background:   '#F5F7FA',
  textPrimary:  '#212121',
  textSecondary:'#757575',
  lowStock:     '#FFEBEE',
  lowStockText: '#C62828',
};

export const ROUTES = {
  HOME:         'Home',
  RECORD_SALE:  'RecordSale',
  RESTOCK:      'Restock',
  ADD_PRODUCT:  'AddProduct',
  VIEW_STOCK:   'ViewStock',
  EXCEL_VIEW:   'ExcelView',
  EDIT_PRODUCT: 'EditProduct',
  IMPORT_STOCK: 'ImportStock',   // ← NEW
};