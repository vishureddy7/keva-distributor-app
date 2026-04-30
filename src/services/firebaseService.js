// ─────────────────────────────────────────────
//  firebaseService.js  (UPDATED)
//  Added: renameProduct()
// ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  where,
} from 'firebase/firestore';

import { db } from './firebase';
import { getNowTimestamp } from '../utils/dateHelpers';
import { ENTRY_TYPE } from '../utils/constants';

// ── Collection references ─────────────────────
const productsCol     = () => collection(db, 'products');
const transactionsCol = () => collection(db, 'transactions');

// ─────────────────────────────────────────────
//  READ
// ─────────────────────────────────────────────

export async function getProductList() {
  const snap = await getDocs(productsCol());
  return snap.docs.map((d) => d.data()).filter((p) => p.productName);
}

export function subscribeToProducts(onUpdate) {
  return onSnapshot(productsCol(), (snap) => {
    const products = snap.docs
      .map((d) => d.data())
      .filter((p) => p.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));
    onUpdate(products);
  });
}

export async function getCurrentStockFor(productName) {
  const ref  = doc(db, 'products', productName.trim());
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().currentStock || 0) : 0;
}

export async function getTransactionsFor(productName) {
  const q    = query(transactionsCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((t) => t.productName === productName.trim());
}

// ─────────────────────────────────────────────
//  WRITE: Add New Product
// ─────────────────────────────────────────────

export async function addNewProduct(productName, openingQty) {
  const name = productName.trim();
  const qty  = Number(openingQty);
  const now  = getNowTimestamp();

  const batch = writeBatch(db);

  const productRef = doc(db, 'products', name);
  batch.set(productRef, {
    productName:  name,
    totalStockIn: qty,
    totalSold:    0,
    currentStock: qty,
    lastUpdated:  now,
  });

  const txRef = doc(transactionsCol());
  batch.set(txRef, {
    productName:      name,
    type:             ENTRY_TYPE.OPENING_STOCK,
    customerOrSource: 'SYSTEM',
    quantity:         qty,
    timestamp:        now,
    createdAt:        Date.now(),
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Rename a Product
// ─────────────────────────────────────────────

/**
 * Renames a product in Firestore.
 * Since the doc ID is the product name, we:
 *   1. Read the old doc
 *   2. Create a new doc with the new name
 *   3. Delete the old doc
 * Transactions collection keeps old productName value
 * (history stays intact) but new transactions will use new name.
 *
 * @param {string} oldName
 * @param {string} newName
 */
export async function renameProduct(oldName, newName) {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (trimmedOld === trimmedNew) return;

  // ── Check new name doesn't already exist ──
  const newRef  = doc(db, 'products', trimmedNew);
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) {
    throw new Error(`A product named "${trimmedNew}" already exists.`);
  }

  // ── Read old doc ──────────────────────────
  const oldRef  = doc(db, 'products', trimmedOld);
  const oldSnap = await getDoc(oldRef);
  if (!oldSnap.exists()) {
    throw new Error(`Product "${trimmedOld}" not found.`);
  }

  const oldData = oldSnap.data();
  const now     = getNowTimestamp();

  // ── Batch: create new + delete old ────────
  const batch = writeBatch(db);

  // Create new product doc with updated name
  batch.set(newRef, {
    ...oldData,
    productName: trimmedNew,
    lastUpdated: now,
  });

  // Delete old product doc
  batch.delete(oldRef);

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Delete a Product
// ─────────────────────────────────────────────

/**
 * Permanently deletes a product document from Firestore.
 * Transactions (history) are kept intact for audit purposes.
 *
 * @param {string} productName
 */
export async function deleteProduct(productName) {
  const name       = productName.trim();
  const productRef = doc(db, 'products', name);
  const snap       = await getDoc(productRef);

  if (!snap.exists()) {
    throw new Error(`Product "${name}" not found.`);
  }

  await deleteDoc(productRef);
}

// ─────────────────────────────────────────────
//  WRITE: Bulk Import Stock (from invoice)
// ─────────────────────────────────────────────

/**
 * Imports an array of products from an invoice / stock transfer.
 * - If the product already exists → adds qty to stock (restock).
 * - If the product is new         → creates it with qty as opening stock.
 * - Buy 1 Get 2 Free items must already have qty × 3 applied by the caller.
 *
 * @param {Array<{ productName: string, qty: number, isBogo: boolean }>} items
 * @param {string} [source]  — label stored in transactions (default: 'KEVA IMPORT')
 */
export async function bulkImportStock(items, source = 'KEVA IMPORT') {
  if (!items || items.length === 0) return;

  const now = getNowTimestamp();

  // Fetch all existing product docs in parallel
  const refs  = items.map((item) => doc(db, 'products', item.productName.trim()));
  const snaps = await Promise.all(refs.map((r) => getDoc(r)));

  const batch = writeBatch(db);

  for (let i = 0; i < items.length; i++) {
    const item     = items[i];
    const name     = item.productName.trim();
    const qty      = Number(item.qty);
    const snap     = snaps[i];
    const txRef    = doc(transactionsCol());

    if (snap.exists()) {
      // ── Existing product: top up stock ──
      const data = snap.data();
      batch.update(refs[i], {
        totalStockIn: (data.totalStockIn || 0) + qty,
        currentStock: (data.currentStock || 0) + qty,
        lastUpdated:  now,
      });
      batch.set(txRef, {
        productName:      name,
        type:             ENTRY_TYPE.STOCK_IN,
        customerOrSource: source,
        quantity:         qty,
        timestamp:        now,
        createdAt:        Date.now() + i,
      });
    } else {
      // ── New product: create with opening stock ──
      batch.set(refs[i], {
        productName:  name,
        totalStockIn: qty,
        totalSold:    0,
        currentStock: qty,
        lastUpdated:  now,
      });
      batch.set(txRef, {
        productName:      name,
        type:             ENTRY_TYPE.OPENING_STOCK,
        customerOrSource: source,
        quantity:         qty,
        timestamp:        now,
        createdAt:        Date.now() + i,
      });
    }
  }

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Record a Sale (atomic)
// ─────────────────────────────────────────────

export async function recordSale(customerName, items) {
  const now = getNowTimestamp();

  const productSnaps = await Promise.all(
    items.map((item) => getDoc(doc(db, 'products', item.productName.trim()))),
  );

  for (let i = 0; i < items.length; i++) {
    const snap = productSnaps[i];
    if (!snap.exists()) {
      throw new Error(`Product "${items[i].productName}" not found.`);
    }
    const available = snap.data().currentStock || 0;
    if (items[i].qty > available) {
      throw new Error(
        `⚠ Only ${available} unit${available !== 1 ? 's' : ''} of "${items[i].productName}" available.`,
      );
    }
  }

  const batch = writeBatch(db);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const data = productSnaps[i].data();
    const qty  = Number(item.qty);

    const productRef = doc(db, 'products', item.productName.trim());
    batch.update(productRef, {
      totalSold:    (data.totalSold    || 0) + qty,
      currentStock: (data.currentStock || 0) - qty,
      lastUpdated:  now,
    });

    const txRef = doc(transactionsCol());
    batch.set(txRef, {
      productName:      item.productName.trim(),
      type:             ENTRY_TYPE.SALE,
      customerOrSource: customerName.trim(),
      quantity:         qty,
      timestamp:        now,
      createdAt:        Date.now() + i,
    });
  }

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Record a Restock
// ─────────────────────────────────────────────

export async function recordRestock(productName, qty, remarks = '') {
  const name   = productName.trim();
  const amount = Number(qty);
  const now    = getNowTimestamp();
  const source = remarks.trim() || 'SUPPLIER';

  const productRef = doc(db, 'products', name);
  const snap       = await getDoc(productRef);

  if (!snap.exists()) {
    throw new Error(`Product "${name}" not found.`);
  }

  const data  = snap.data();
  const batch = writeBatch(db);

  batch.update(productRef, {
    totalStockIn: (data.totalStockIn || 0) + amount,
    currentStock: (data.currentStock || 0) + amount,
    lastUpdated:  now,
  });

  const txRef = doc(transactionsCol());
  batch.set(txRef, {
    productName:      name,
    type:             ENTRY_TYPE.STOCK_IN,
    customerOrSource: source,
    quantity:         amount,
    timestamp:        now,
    createdAt:        Date.now(),
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  EXCEL EXPORT
// ─────────────────────────────────────────────

import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import {
  TOTAL_STOCK_HEADERS,
  PRODUCT_SHEET_HEADERS,
  EXCEL_FILE_NAME,
} from '../utils/constants';

export async function generateAndSaveExcel() {
  const wb       = XLSX.utils.book_new();
  const products = await getProductList();

  // ── Total Stock sheet ─────────────────────
  const totalRows = [TOTAL_STOCK_HEADERS];
  for (const p of products) {
    totalRows.push([
      p.productName,
      p.totalStockIn,
      p.totalSold,
      p.currentStock,
      p.lastUpdated,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalRows), 'Total Stock');

  // ── Per-product sheets ────────────────────
  const allTxSnap = await getDocs(transactionsCol());
  const allTx     = allTxSnap.docs.map((d) => d.data());

  for (const p of products) {
    const sheetName = p.productName.slice(0, 31);
    const txRows    = [PRODUCT_SHEET_HEADERS];

    const productTx = allTx
      .filter((t) => t.productName === p.productName)
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const t of productTx) {
      txRows.push([t.timestamp, t.type, t.customerOrSource, t.quantity]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), sheetName);
  }

  // ── Save to disk ──────────────────────────
  const filePath = `${FileSystem.documentDirectory}${EXCEL_FILE_NAME}`;
  const base64   = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;
}