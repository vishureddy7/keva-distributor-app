// ─────────────────────────────────────────────
//  validators.js
//  Pure validation functions — no side effects.
//  Each function returns { valid: bool, error: string|null }
// ─────────────────────────────────────────────

import {
  MIN_CUSTOMER_NAME_LEN,
  MIN_PRODUCT_NAME_LEN,
  MAX_SHEET_NAME_LENGTH,
} from './constants';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Normalises a string for comparison: trim + lowercase.
 * Used for case-insensitive uniqueness checks.
 */
export function normalise(str = '') {
  return str.trim().toLowerCase();
}

/**
 * Truncates a product name to fit Excel's 31-char sheet name limit.
 * Returns the truncated string (full name is still stored in cell A1).
 */
export function toSheetName(productName = '') {
  return productName.trim().slice(0, MAX_SHEET_NAME_LENGTH);
}

// ─────────────────────────────────────────────
//  Customer name validation
// ─────────────────────────────────────────────

/**
 * Validates a customer name field.
 *
 * @param {string} name
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateCustomerName(name) {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    return { valid: false, error: 'Customer name is required.' };
  }
  if (trimmed.length < MIN_CUSTOMER_NAME_LEN) {
    return {
      valid: false,
      error: `Customer name must be at least ${MIN_CUSTOMER_NAME_LEN} characters.`,
    };
  }
  return { valid: true, error: null };
}

// ─────────────────────────────────────────────
//  Product name validation
// ─────────────────────────────────────────────

/**
 * Validates a new product name.
 * Also checks uniqueness against the existing product list.
 *
 * @param {string}   name            — the name being entered
 * @param {string[]} existingNames   — array of current product names
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateProductName(name, existingNames = []) {
  const trimmed = (name || '').trim();

  if (!trimmed) {
    return { valid: false, error: 'Product name is required.' };
  }
  if (trimmed.length < MIN_PRODUCT_NAME_LEN) {
    return {
      valid: false,
      error: `Product name must be at least ${MIN_PRODUCT_NAME_LEN} characters.`,
    };
  }

  // Case-insensitive uniqueness check
  const isDuplicate = existingNames.some(
    (existing) => normalise(existing) === normalise(trimmed),
  );
  if (isDuplicate) {
    return {
      valid: false,
      error: `"${trimmed}" already exists. Product names must be unique.`,
    };
  }

  return { valid: true, error: null };
}

// ─────────────────────────────────────────────
//  Quantity validation
// ─────────────────────────────────────────────

/**
 * Validates a generic quantity field (must be a positive number).
 *
 * @param {string|number} qty
 * @param {{ allowZero?: boolean }} options
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateQuantity(qty, { allowZero = false } = {}) {
  const num = parseFloat(qty);

  if (qty === '' || qty === null || qty === undefined) {
    return { valid: false, error: 'Quantity is required.' };
  }
  if (isNaN(num)) {
    return { valid: false, error: 'Quantity must be a number.' };
  }
  if (!allowZero && num <= 0) {
    return { valid: false, error: 'Quantity must be greater than 0.' };
  }
  if (allowZero && num < 0) {
    return { valid: false, error: 'Quantity cannot be negative.' };
  }

  return { valid: true, error: null };
}

/**
 * Validates a sale quantity against current available stock.
 * Combines basic quantity check + stock-limit check.
 *
 * @param {string|number} qty
 * @param {number}        currentStock
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateSaleQuantity(qty, currentStock) {
  const basicCheck = validateQuantity(qty);
  if (!basicCheck.valid) return basicCheck;

  const num = parseFloat(qty);
  if (num > currentStock) {
    return {
      valid: false,
      error: `⚠ Only ${currentStock} unit${currentStock !== 1 ? 's' : ''} available in stock.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates an opening stock quantity (can be 0 for pre-orders, etc.)
 *
 * @param {string|number} qty
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateOpeningStock(qty) {
  return validateQuantity(qty, { allowZero: true });
}

// ─────────────────────────────────────────────
//  Sale form validation (full form)
// ─────────────────────────────────────────────

/**
 * Validates the entire Record Sale form in one call.
 * Returns a map of field → error string (empty map = all valid).
 *
 * @param {string}  customerName
 * @param {Array<{ productName: string, qty: string|number, currentStock: number }>} items
 * @returns {{ errors: Object, valid: boolean }}
 */
export function validateSaleForm(customerName, items = []) {
  const errors = {};

  // Customer name
  const nameCheck = validateCustomerName(customerName);
  if (!nameCheck.valid) errors.customerName = nameCheck.error;

  // Must select at least one product
  if (!items || items.length === 0) {
    errors.products = 'Please select at least one product.';
  } else {
    items.forEach((item, index) => {
      const qtyCheck = validateSaleQuantity(item.qty, item.currentStock);
      if (!qtyCheck.valid) {
        errors[`qty_${index}`] = qtyCheck.error;
      }
    });
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

// ─────────────────────────────────────────────
//  Restock form validation (full form)
// ─────────────────────────────────────────────

/**
 * Validates the Restock form in one call.
 *
 * @param {string}        productName
 * @param {string|number} qty
 * @returns {{ errors: Object, valid: boolean }}
 */
export function validateRestockForm(productName, qty) {
  const errors = {};

  if (!productName || !productName.trim()) {
    errors.product = 'Please select a product.';
  }

  const qtyCheck = validateQuantity(qty);
  if (!qtyCheck.valid) errors.qty = qtyCheck.error;

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
}