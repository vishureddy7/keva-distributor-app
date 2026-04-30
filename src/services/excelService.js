// ─────────────────────────────────────────────
//  excelService.js
//  All Excel read / write operations via SheetJS.
//  The .xlsx file is the single source of truth.
// ─────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import {
  EXCEL_FILE_NAME,
  TOTAL_STOCK_SHEET,
  TOTAL_STOCK_HEADERS,
  PRODUCT_SHEET_HEADERS,
  COL_PRODUCT_NAME,
  COL_TOTAL_STOCK_IN,
  COL_TOTAL_SOLD,
  COL_CURRENT_STOCK,
  COL_LAST_UPDATED,
  PROD_COL_DATETIME,
  PROD_COL_TYPE,
  PROD_COL_CUSTOMER,
  PROD_COL_QTY,
  ENTRY_TYPE,
  MAX_SHEET_NAME_LENGTH,
} from '../utils/constants';

import { getNowTimestamp } from '../utils/dateHelpers';
import { toSheetName }     from '../utils/validators';

// ── File path on device ───────────────────────
const FILE_PATH = `${FileSystem.documentDirectory}${EXCEL_FILE_NAME}`;

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

/**
 * Converts a 2-D array of rows into a SheetJS worksheet object.
 */
function rowsToSheet(rows) {
  return XLSX.utils.aoa_to_sheet(rows);
}

/**
 * Converts a SheetJS worksheet into a 2-D array of rows.
 * header: 1  → first row becomes plain array, not object keys.
 */
function sheetToRows(ws) {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

/**
 * Reads the raw base64 string from disk and parses it into a workbook.
 * Returns null if the file does not exist yet.
 */
async function readWorkbookFromDisk() {
  const info = await FileSystem.getInfoAsync(FILE_PATH);
  if (!info.exists) return null;

  const base64 = await FileSystem.readAsStringAsync(FILE_PATH, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return XLSX.read(base64, { type: 'base64' });
}

/**
 * Serialises a workbook to base64 and writes it to disk atomically.
 */
async function writeWorkbookToDisk(workbook) {
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  await FileSystem.writeAsStringAsync(FILE_PATH, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Creates a brand-new workbook with an empty "Total Stock" sheet.
 * Called automatically on first launch.
 */
function createBlankWorkbook() {
  const wb = XLSX.utils.book_new();
  const ws = rowsToSheet([TOTAL_STOCK_HEADERS]);
  XLSX.utils.book_append_sheet(wb, ws, TOTAL_STOCK_SHEET);
  return wb;
}

/**
 * Returns the row index (1-based inside the data array, 0 = header)
 * of a product in the Total Stock sheet, or -1 if not found.
 */
function findProductRow(rows, productName) {
  for (let i = 1; i < rows.length; i++) {
    if (
      String(rows[i][COL_PRODUCT_NAME]).trim().toLowerCase() ===
      productName.trim().toLowerCase()
    ) {
      return i;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

/**
 * Ensures the Excel file exists on disk.
 * If it doesn't, creates a new blank workbook and saves it.
 * Call this once on app startup (inside AppContext).
 */
export async function initWorkbook() {
  const info = await FileSystem.getInfoAsync(FILE_PATH);
  if (!info.exists) {
    const wb = createBlankWorkbook();
    await writeWorkbookToDisk(wb);
  }
}

/**
 * Returns the file path string so screens can display / share it.
 */
export function getFilePath() {
  return FILE_PATH;
}

// ── READ ──────────────────────────────────────

/**
 * Reads the Total Stock sheet and returns an array of product objects.
 *
 * @returns {Promise<Array<{
 *   productName: string,
 *   totalStockIn: number,
 *   totalSold: number,
 *   currentStock: number,
 *   lastUpdated: string,
 * }>>}
 */
export async function getProductList() {
  const wb = await readWorkbookFromDisk();
  if (!wb) return [];

  const ws   = wb.Sheets[TOTAL_STOCK_SHEET];
  const rows = sheetToRows(ws);

  // Skip header row (index 0)
  return rows.slice(1).map((row) => ({
    productName:   String(row[COL_PRODUCT_NAME]   || '').trim(),
    totalStockIn:  Number(row[COL_TOTAL_STOCK_IN]  || 0),
    totalSold:     Number(row[COL_TOTAL_SOLD]       || 0),
    currentStock:  Number(row[COL_CURRENT_STOCK]    || 0),
    lastUpdated:   String(row[COL_LAST_UPDATED]    || ''),
  })).filter((p) => p.productName !== '');
}

/**
 * Returns current stock for a single product (or 0 if not found).
 *
 * @param {string} productName
 * @returns {Promise<number>}
 */
export async function getCurrentStockFor(productName) {
  const list = await getProductList();
  const product = list.find(
    (p) => p.productName.toLowerCase() === productName.trim().toLowerCase(),
  );
  return product ? product.currentStock : 0;
}

// ── WRITE: Add New Product ────────────────────

/**
 * Adds a new product to the workbook:
 *   1. Appends a row to the Total Stock sheet.
 *   2. Creates a new per-product sheet.
 *   3. Appends an OPENING STOCK row on that sheet.
 *
 * @param {string} productName
 * @param {number} openingQty
 */
export async function addNewProduct(productName, openingQty) {
  const wb = (await readWorkbookFromDisk()) || createBlankWorkbook();

  const trimmedName = productName.trim();
  const sheetName   = toSheetName(trimmedName); // max 31 chars
  const now         = getNowTimestamp();
  const qty         = Number(openingQty);

  // ── 1. Update Total Stock sheet ──
  const totalWs   = wb.Sheets[TOTAL_STOCK_SHEET];
  const totalRows = sheetToRows(totalWs);

  const newProductRow = [
    trimmedName, // A — Product Name
    qty,         // B — Total Stock In
    0,           // C — Total Sold
    qty,         // D — Current Stock
    now,         // E — Last Updated
  ];
  totalRows.push(newProductRow);

  wb.Sheets[TOTAL_STOCK_SHEET] = rowsToSheet(totalRows);

  // ── 2. Create per-product sheet ──
  const productRows = [
    PRODUCT_SHEET_HEADERS,
    [now, ENTRY_TYPE.OPENING_STOCK, 'SYSTEM', qty],
  ];

  // If full name was truncated, store it in a comment row at the top
  const productWs = rowsToSheet(productRows);

  // Guard: don't overwrite if sheet already exists (shouldn't happen)
  if (!wb.Sheets[sheetName]) {
    XLSX.utils.book_append_sheet(wb, productWs, sheetName);
  }

  await writeWorkbookToDisk(wb);
}

// ── WRITE: Record a Sale ──────────────────────

/**
 * Records a customer sale (atomic: all products or none).
 *
 * @param {string} customerName
 * @param {Array<{ productName: string, qty: number }>} items
 * @throws Will throw if any product has insufficient stock.
 */
export async function recordSale(customerName, items) {
  const wb = await readWorkbookFromDisk();
  if (!wb) throw new Error('Excel file not found. Please restart the app.');

  const totalWs   = wb.Sheets[TOTAL_STOCK_SHEET];
  const totalRows = sheetToRows(totalWs);
  const now       = getNowTimestamp();

  // ── Pre-flight: validate stock for ALL items before writing anything ──
  for (const item of items) {
    const rowIdx = findProductRow(totalRows, item.productName);
    if (rowIdx === -1) {
      throw new Error(`Product "${item.productName}" not found in stock sheet.`);
    }
    const available = Number(totalRows[rowIdx][COL_CURRENT_STOCK] || 0);
    if (item.qty > available) {
      throw new Error(
        `⚠ Only ${available} unit${available !== 1 ? 's' : ''} of "${item.productName}" available.`,
      );
    }
  }

  // ── All checks passed — now write ──
  for (const item of items) {
    const rowIdx = findProductRow(totalRows, item.productName);
    const qty    = Number(item.qty);

    // Update Total Stock sheet row
    totalRows[rowIdx][COL_TOTAL_SOLD]    = Number(totalRows[rowIdx][COL_TOTAL_SOLD] || 0) + qty;
    totalRows[rowIdx][COL_CURRENT_STOCK] = Number(totalRows[rowIdx][COL_CURRENT_STOCK] || 0) - qty;
    totalRows[rowIdx][COL_LAST_UPDATED]  = now;

    // Append row to per-product sheet
    const sheetName  = toSheetName(item.productName);
    const productWs  = wb.Sheets[sheetName];
    const productRows = sheetToRows(productWs);

    productRows.push([now, ENTRY_TYPE.SALE, customerName.trim(), qty]);
    wb.Sheets[sheetName] = rowsToSheet(productRows);
  }

  // Flush updated Total Stock sheet
  wb.Sheets[TOTAL_STOCK_SHEET] = rowsToSheet(totalRows);

  await writeWorkbookToDisk(wb);
}

// ── WRITE: Record a Restock ───────────────────

/**
 * Records a stock-in event for a single product.
 *
 * @param {string} productName
 * @param {number} qty
 * @param {string} [remarks]   — optional note stored in Customer/Source column
 */
export async function recordRestock(productName, qty, remarks = '') {
  const wb = await readWorkbookFromDisk();
  if (!wb) throw new Error('Excel file not found. Please restart the app.');

  const totalWs   = wb.Sheets[TOTAL_STOCK_SHEET];
  const totalRows = sheetToRows(totalWs);
  const now       = getNowTimestamp();
  const amount    = Number(qty);

  const rowIdx = findProductRow(totalRows, productName);
  if (rowIdx === -1) {
    throw new Error(`Product "${productName}" not found.`);
  }

  // Update Total Stock sheet
  totalRows[rowIdx][COL_TOTAL_STOCK_IN] = Number(totalRows[rowIdx][COL_TOTAL_STOCK_IN] || 0) + amount;
  totalRows[rowIdx][COL_CURRENT_STOCK]  = Number(totalRows[rowIdx][COL_CURRENT_STOCK]  || 0) + amount;
  totalRows[rowIdx][COL_LAST_UPDATED]   = now;

  wb.Sheets[TOTAL_STOCK_SHEET] = rowsToSheet(totalRows);

  // Append to per-product sheet
  const sheetName   = toSheetName(productName);
  const productWs   = wb.Sheets[sheetName];
  const productRows = sheetToRows(productWs);

  const source = remarks.trim() || 'SUPPLIER';
  productRows.push([now, ENTRY_TYPE.STOCK_IN, source, amount]);
  wb.Sheets[sheetName] = rowsToSheet(productRows);

  await writeWorkbookToDisk(wb);
}