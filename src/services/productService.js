// ─────────────────────────────────────────────
//  productService.js  (UPDATED)
//  Added: deleteProduct(), bulkImportStock()
// ─────────────────────────────────────────────

import {
  addNewProduct    as fbAddNewProduct,
  getProductList,
  renameProduct    as fbRenameProduct,
  deleteProduct    as fbDeleteProduct,
  bulkImportStock  as fbBulkImportStock,
} from './firebaseService';

import {
  validateProductName,
  validateOpeningStock,
} from '../utils/validators';

export async function addProduct(name, openingQty, existingNames = []) {
  const nameCheck = validateProductName(name, existingNames);
  if (!nameCheck.valid) throw new Error(nameCheck.error);

  const qtyCheck = validateOpeningStock(openingQty);
  if (!qtyCheck.valid) throw new Error(qtyCheck.error);

  await fbAddNewProduct(name.trim(), Number(openingQty));
}

export async function fetchProducts() {
  return getProductList();
}

/**
 * Renames a product after validating the new name.
 */
export async function renameProduct(oldName, newName, existingNames = []) {
  const trimmedNew = newName.trim();
  const otherNames = existingNames.filter(
    (n) => n.toLowerCase() !== oldName.trim().toLowerCase()
  );

  const nameCheck = validateProductName(trimmedNew, otherNames);
  if (!nameCheck.valid) throw new Error(nameCheck.error);

  await fbRenameProduct(oldName.trim(), trimmedNew);
}

/**
 * Permanently deletes a product from Firestore.
 * Transaction history is preserved for audit purposes.
 */
export async function deleteProduct(productName) {
  if (!productName || !productName.trim()) {
    throw new Error('Product name is required.');
  }
  await fbDeleteProduct(productName.trim());
}

/**
 * Bulk-imports stock from an invoice / stock transfer.
 * Caller must pass qty already multiplied x3 for Buy 1 Get 2 Free items.
 */
export async function bulkImportStock(items, source = 'KEVA IMPORT') {
  if (!items || items.length === 0) {
    throw new Error('No items to import.');
  }

  for (const item of items) {
    if (!item.productName || !item.productName.trim()) {
      throw new Error('Every item must have a product name.');
    }
    if (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0) {
      throw new Error('Invalid quantity for "' + item.productName + '".');
    }
  }

  await fbBulkImportStock(items, source.trim() || 'KEVA IMPORT');
}