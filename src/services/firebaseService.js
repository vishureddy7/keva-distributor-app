// ─────────────────────────────────────────────
//  firebaseService.js
//  Added: getAllTransactions, getProductTransactions,
//         updateSaleTransaction, deleteSaleTransaction
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

/**
 * Returns ALL transactions sorted newest first, each with its Firestore doc ID.
 * Filter by type client-side to avoid composite index requirements.
 *
 * @returns {Promise<Array<{ id: string, productName: string, type: string,
 *   customerOrSource: string, quantity: number, timestamp: string, createdAt: number }>>}
 */
export async function getAllTransactions() {
  const q    = query(transactionsCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Returns all transactions for a single product, newest first, with Firestore doc IDs.
 *
 * @param {string} productName
 * @returns {Promise<Array>}
 */
export async function getProductTransactions(productName) {
  const q    = query(transactionsCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.productName === productName.trim());
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

export async function renameProduct(oldName, newName) {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (trimmedOld === trimmedNew) return;

  const newRef  = doc(db, 'products', trimmedNew);
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) {
    throw new Error(`A product named "${trimmedNew}" already exists.`);
  }

  const oldRef  = doc(db, 'products', trimmedOld);
  const oldSnap = await getDoc(oldRef);
  if (!oldSnap.exists()) {
    throw new Error(`Product "${trimmedOld}" not found.`);
  }

  const oldData = oldSnap.data();
  const now     = getNowTimestamp();

  const batch = writeBatch(db);
  batch.set(newRef, { ...oldData, productName: trimmedNew, lastUpdated: now });
  batch.delete(oldRef);

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Delete a Product
// ─────────────────────────────────────────────

export async function deleteProduct(productName) {
  const name       = productName.trim();
  const productRef = doc(db, 'products', name);
  const snap       = await getDoc(productRef);

  if (!snap.exists()) {
    throw new Error(`Product "${name}" not found.`);
  }

  // Fetch ALL transactions for this product so we can wipe them too.
  // Without this, deleted-product sales kept showing in CustomerSalesScreen.
  const txQuery = query(transactionsCol(), where('productName', '==', name));
  const txSnap  = await getDocs(txQuery);

  // Also wipe any billedUnsold entries for this product
  const buQuery = query(billedUnsoldCol(), where('productName', '==', name));
  const buSnap  = await getDocs(buQuery);

  const allDocsToDelete = [
    productRef,
    ...txSnap.docs.map((d) => d.ref),
    ...buSnap.docs.map((d) => d.ref),
  ];

  // Firestore batches are limited to 500 ops — chunk if necessary
  const BATCH_LIMIT = 499;
  for (let i = 0; i < allDocsToDelete.length; i += BATCH_LIMIT) {
    const chunk = allDocsToDelete.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// ─────────────────────────────────────────────
//  WRITE: Update a Sale Transaction
//  Supports changing customer, quantity AND product.
//  Properly reverses old stock and applies new stock.
// ─────────────────────────────────────────────

/**
 * @param {string} txId             — Firestore transaction doc ID
 * @param {{ productName: string, quantity: number }} originalTx
 * @param {{ productName: string, customerOrSource: string, quantity: number }} updatedTx
 */
export async function updateSaleTransaction(txId, originalTx, updatedTx) {
  const now    = getNowTimestamp();
  const batch  = writeBatch(db);
  const txRef  = doc(transactionsCol(), txId);

  const sameProduct = originalTx.productName.trim() === updatedTx.productName.trim();

  if (sameProduct) {
    // ── Same product — just adjust the delta ──
    const productRef  = doc(db, 'products', originalTx.productName.trim());
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) throw new Error(`Product "${originalTx.productName}" not found.`);

    const data = productSnap.data();
    const diff = updatedTx.quantity - originalTx.quantity;      // +ve = selling more
    const newStock = (data.currentStock || 0) - diff;

    if (newStock < 0) {
      throw new Error(
        `Not enough stock. Only ${data.currentStock} unit${data.currentStock !== 1 ? 's' : ''} available.`,
      );
    }

    batch.update(productRef, {
      totalSold:    (data.totalSold    || 0) + diff,
      currentStock: newStock,
      lastUpdated:  now,
    });
  } else {
    // ── Different product — reverse old, apply new ──

    // Reverse old product
    const oldProductRef  = doc(db, 'products', originalTx.productName.trim());
    const oldProductSnap = await getDoc(oldProductRef);
    if (!oldProductSnap.exists()) throw new Error(`Product "${originalTx.productName}" not found.`);

    const oldData = oldProductSnap.data();
    batch.update(oldProductRef, {
      totalSold:    Math.max(0, (oldData.totalSold    || 0) - originalTx.quantity),
      currentStock: (oldData.currentStock || 0) + originalTx.quantity,
      lastUpdated:  now,
    });

    // Apply new product
    const newProductRef  = doc(db, 'products', updatedTx.productName.trim());
    const newProductSnap = await getDoc(newProductRef);
    if (!newProductSnap.exists()) throw new Error(`Product "${updatedTx.productName}" not found.`);

    const newData = newProductSnap.data();
    if (updatedTx.quantity > (newData.currentStock || 0)) {
      throw new Error(
        `Not enough stock for "${updatedTx.productName}". Only ${newData.currentStock} available.`,
      );
    }

    batch.update(newProductRef, {
      totalSold:    (newData.totalSold    || 0) + updatedTx.quantity,
      currentStock: (newData.currentStock || 0) - updatedTx.quantity,
      lastUpdated:  now,
    });
  }

  // Update transaction document
  batch.update(txRef, {
    productName:      updatedTx.productName.trim(),
    customerOrSource: updatedTx.customerOrSource.trim(),
    quantity:         updatedTx.quantity,
    timestamp:        now,
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Delete a Sale Transaction
//  Reverses the stock change caused by that sale.
// ─────────────────────────────────────────────

/**
 * @param {string} txId
 * @param {string} productName
 * @param {number} qty
 */
export async function deleteSaleTransaction(txId, productName, qty) {
  const now        = getNowTimestamp();
  const productRef = doc(db, 'products', productName.trim());
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    throw new Error(`Product "${productName}" not found.`);
  }

  const data  = productSnap.data();
  const batch = writeBatch(db);

  batch.delete(doc(transactionsCol(), txId));

  batch.update(productRef, {
    totalSold:    Math.max(0, (data.totalSold    || 0) - qty),
    currentStock: (data.currentStock || 0) + qty,
    lastUpdated:  now,
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Update an entire Sale Group
//  Called when the user edits a grouped sale card:
//  customer name, timestamp, added/removed/edited products.
//
//  Algorithm (atomic batch):
//   1. Restore stock for ALL original items.
//   2. Deduct stock for ALL new items.
//   3. Delete all original transaction docs.
//   4. Create new transaction docs.
//
//  @param {Array<{id, productName, quantity}>} originalItems
//  @param {Array<{productName, quantity}>}     newItems
//  @param {string} newCustomer
//  @param {string} newTimestamp   — human-readable e.g. "06-May-2026 3:45 PM"
//  @param {number} originalCreatedAt — epoch ms for ordering
// ─────────────────────────────────────────────

export async function updateSaleGroup(
  originalItems,
  newItems,
  newCustomer,
  newTimestamp,
  originalCreatedAt,
  newBillingStatus = 'billed',
) {
  const now   = getNowTimestamp();
  const batch = writeBatch(db);

  // ── Pre-fetch all affected product docs ──
  const allProductNames = [
    ...new Set([
      ...originalItems.map((i) => i.productName.trim()),
      ...newItems.map((i) => i.productName.trim()),
    ]),
  ];
  const productRefs  = allProductNames.map((n) => doc(db, 'products', n));
  const productSnaps = await Promise.all(productRefs.map((r) => getDoc(r)));

  const productDataMap = {};
  allProductNames.forEach((name, idx) => {
    if (!productSnaps[idx].exists()) {
      throw new Error(`Product "${name}" not found.`);
    }
    productDataMap[name] = { ...productSnaps[idx].data() };
  });

  // ── Step 1: restore old item stock (in-memory) ──
  for (const item of originalItems) {
    const name = item.productName.trim();
    const data = productDataMap[name];
    data.currentStock = (data.currentStock || 0) + item.quantity;
    data.totalSold    = Math.max(0, (data.totalSold || 0) - item.quantity);
  }

  // ── Step 2: validate and apply new item stock (in-memory) ──
  for (const item of newItems) {
    const name = item.productName.trim();
    const data = productDataMap[name];
    if (item.quantity > data.currentStock) {
      throw new Error(
        `Not enough stock for "${name}". Only ${data.currentStock} unit${data.currentStock !== 1 ? 's' : ''} available.`,
      );
    }
    data.currentStock = data.currentStock - item.quantity;
    data.totalSold    = (data.totalSold || 0) + item.quantity;
  }

  // ── Step 3: write product updates to batch ──
  allProductNames.forEach((name, idx) => {
    batch.update(productRefs[idx], {
      currentStock: productDataMap[name].currentStock,
      totalSold:    productDataMap[name].totalSold,
      lastUpdated:  now,
    });
  });

  // ── Step 4: delete original transaction docs ──
  for (const item of originalItems) {
    batch.delete(doc(transactionsCol(), item.id));
  }

  // ── Step 5: create new transaction docs ──
  const baseCreatedAt = originalCreatedAt || Date.now();
  newItems.forEach((item, i) => {
    const txRef = doc(transactionsCol());
    batch.set(txRef, {
      productName:      item.productName.trim(),
      type:             ENTRY_TYPE.SALE,
      customerOrSource: newCustomer.trim(),
      quantity:         item.quantity,
      timestamp:        newTimestamp,
      createdAt:        baseCreatedAt + i,
      billingStatus:    newBillingStatus,
    });
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Delete an entire Sale Group
//  Reverses stock for every item in the group.
//
//  @param {Array<{id, productName, quantity}>} groupItems
// ─────────────────────────────────────────────

export async function deleteSaleGroup(groupItems) {
  const now   = getNowTimestamp();
  const batch = writeBatch(db);

  // Fetch all affected product docs
  const productRefs  = groupItems.map((i) => doc(db, 'products', i.productName.trim()));
  const productSnaps = await Promise.all(productRefs.map((r) => getDoc(r)));

  groupItems.forEach((item, idx) => {
    const snap = productSnaps[idx];
    if (!snap.exists()) return; // product may have been deleted — skip

    const data = snap.data();
    batch.update(productRefs[idx], {
      currentStock: (data.currentStock || 0) + item.quantity,
      totalSold:    Math.max(0, (data.totalSold || 0) - item.quantity),
      lastUpdated:  now,
    });

    batch.delete(doc(transactionsCol(), item.id));
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Update an entire Restock Group
//
//  Algorithm (atomic batch):
//   1. Reverse original items: currentStock -= original, totalStockIn -= original
//   2. Apply new items:        currentStock += new,      totalStockIn += new
//   3. Delete original tx docs, create new ones.
//
//  @param {Array<{id, productName, quantity}>} originalItems
//  @param {Array<{productName, quantity}>}     newItems
//  @param {string} newSource
//  @param {string} newTimestamp
//  @param {number} originalCreatedAt
// ─────────────────────────────────────────────

export async function updateRestockGroup(
  originalItems,
  newItems,
  newSource,
  newTimestamp,
  originalCreatedAt,
) {
  const now   = getNowTimestamp();
  const batch = writeBatch(db);

  const allProductNames = [
    ...new Set([
      ...originalItems.map((i) => i.productName.trim()),
      ...newItems.map((i) => i.productName.trim()),
    ]),
  ];
  const productRefs  = allProductNames.map((n) => doc(db, 'products', n));
  const productSnaps = await Promise.all(productRefs.map((r) => getDoc(r)));

  const productDataMap = {};
  allProductNames.forEach((name, idx) => {
    if (!productSnaps[idx].exists()) throw new Error(`Product "${name}" not found.`);
    productDataMap[name] = { ...productSnaps[idx].data() };
  });

  // Step 1: reverse original stock
  for (const item of originalItems) {
    const name = item.productName.trim();
    const data = productDataMap[name];
    data.currentStock  = (data.currentStock  || 0) - item.quantity;
    data.totalStockIn  = Math.max(0, (data.totalStockIn || 0) - item.quantity);
  }

  // Step 2: apply new stock
  for (const item of newItems) {
    const name = item.productName.trim();
    const data = productDataMap[name];
    if (data.currentStock < 0) data.currentStock = 0; // safety floor
    data.currentStock  = data.currentStock  + item.quantity;
    data.totalStockIn  = (data.totalStockIn || 0) + item.quantity;
  }

  // Step 3: write product updates
  allProductNames.forEach((name, idx) => {
    batch.update(productRefs[idx], {
      currentStock: productDataMap[name].currentStock,
      totalStockIn: productDataMap[name].totalStockIn,
      lastUpdated:  now,
    });
  });

  // Step 4: delete old tx docs
  for (const item of originalItems) {
    batch.delete(doc(transactionsCol(), item.id));
  }

  // Step 5: create new tx docs
  const baseCreatedAt = originalCreatedAt || Date.now();
  newItems.forEach((item, i) => {
    const txRef = doc(transactionsCol());
    batch.set(txRef, {
      productName:      item.productName.trim(),
      type:             ENTRY_TYPE.STOCK_IN,
      customerOrSource: newSource.trim() || 'SUPPLIER',
      quantity:         item.quantity,
      timestamp:        newTimestamp,
      createdAt:        baseCreatedAt + i,
    });
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Delete an entire Restock Group
//  Reverses stock for every item in the group.
//
//  @param {Array<{id, productName, quantity}>} groupItems
// ─────────────────────────────────────────────

export async function deleteRestockGroup(groupItems) {
  const now   = getNowTimestamp();
  const batch = writeBatch(db);

  const productRefs  = groupItems.map((i) => doc(db, 'products', i.productName.trim()));
  const productSnaps = await Promise.all(productRefs.map((r) => getDoc(r)));

  groupItems.forEach((item, idx) => {
    const snap = productSnaps[idx];
    if (!snap.exists()) return;

    const data = snap.data();
    batch.update(productRefs[idx], {
      currentStock: Math.max(0, (data.currentStock || 0) - item.quantity),
      totalStockIn: Math.max(0, (data.totalStockIn || 0) - item.quantity),
      lastUpdated:  now,
    });

    batch.delete(doc(transactionsCol(), item.id));
  });

  await batch.commit();
}

// ─────────────────────────────────────────────
//  WRITE: Bulk Import Stock (from invoice)
// ─────────────────────────────────────────────

export async function bulkImportStock(items, source = 'KEVA IMPORT') {
  if (!items || items.length === 0) return;

  const now   = getNowTimestamp();
  const refs  = items.map((item) => doc(db, 'products', item.productName.trim()));
  const snaps = await Promise.all(refs.map((r) => getDoc(r)));
  const batch = writeBatch(db);

  for (let i = 0; i < items.length; i++) {
    const item  = items[i];
    const name  = item.productName.trim();
    const qty   = Number(item.qty);
    const snap  = snaps[i];
    const txRef = doc(transactionsCol());

    if (snap.exists()) {
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

export async function recordSale(customerName, items, billingStatus = 'unbilled') {
  const now = getNowTimestamp();

  const productSnaps = await Promise.all(
    items.map((item) => getDoc(doc(db, 'products', item.productName.trim()))),
  );

  for (let i = 0; i < items.length; i++) {
    const snap = productSnaps[i];
    if (!snap.exists()) throw new Error(`Product "${items[i].productName}" not found.`);
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
      billingStatus:    billingStatus,
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

  if (!snap.exists()) throw new Error(`Product "${name}" not found.`);

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
//  WRITE: Mark an entire Sale Group as Billed
//  Updates billingStatus on all tx docs in a group.
//
//  @param {Array<{id}>} groupItems
// ─────────────────────────────────────────────

export async function markSaleGroupAsBilled(groupItems) {
  const batch = writeBatch(db);
  for (const item of groupItems) {
    batch.update(doc(transactionsCol(), item.id), { billingStatus: 'billed' });
  }
  await batch.commit();
}

// ─────────────────────────────────────────────
//  BILLED (BUT UNSOLD) — separate collection
//  Does NOT affect stock. Purely informational.
// ─────────────────────────────────────────────

const billedUnsoldCol = () => collection(db, 'billedUnsold');

/**
 * Adds a new billed-but-unsold entry.
 * @param {string} productName
 * @param {number} quantity
 * @param {string} [notes]
 */
export async function addBilledUnsold(productName, quantity, notes = '') {
  const now = getNowTimestamp();
  await addDoc(billedUnsoldCol(), {
    productName: productName.trim(),
    quantity:    Number(quantity),
    notes:       notes.trim(),
    timestamp:   now,
    createdAt:   Date.now(),
  });
}

/**
 * Returns all billed-unsold entries, newest first.
 * @returns {Promise<Array<{id, productName, quantity, notes, timestamp, createdAt}>>}
 */
export async function getBilledUnsoldList() {
  const q    = query(billedUnsoldCol(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Deletes a single billed-unsold entry.
 * @param {string} id — Firestore doc ID
 */
export async function deleteBilledUnsoldEntry(id) {
  await deleteDoc(doc(billedUnsoldCol(), id));
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

  // ── Save to device ──────────────────────────
  const filePath = `${FileSystem.documentDirectory}${EXCEL_FILE_NAME}`;
  const base64   = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { filePath, base64 };
}