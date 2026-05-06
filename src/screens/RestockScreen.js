// ─────────────────────────────────────────────
//  RestockScreen.js
//
//  CHANGES:
//   • Previous Stock Arrivals now grouped by
//     timestamp + source (same as how sale groups work).
//   • Each group card has full Edit and Delete options:
//       – Edit source/remarks
//       – Edit quantity per product
//       – Add new products to the group
//       – Remove products from the group
//       – Delete the entire arrival batch
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppContext }          from '../context/AppContext';
import { processRestock }        from '../services/stockService';
import { getAllTransactions }     from '../services/firebaseService';
import { updateRestockGroup }     from '../services/firebaseService';
import { deleteRestockGroup }     from '../services/firebaseService';
import ProductDropdown            from '../components/ProductDropdown';
import ConfirmModal               from '../components/ConfirmModal';
import { COLORS, ENTRY_TYPE }     from '../utils/constants';
import { getNowTimestamp }        from '../utils/dateHelpers';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

let _itemId = 1;
const newItem = () => ({
  id:           String(_itemId++),
  productName:  null,
  qty:          '',
  productError: '',
  qtyError:     '',
});

let _editId = 1;
const makeEditItem = (productName, quantity) => ({
  _key:       String(_editId++),
  productName,
  quantity:   String(quantity),
  qtyError:   '',
  prodError:  '',
});

/** Group STOCK_IN transactions by timestamp + source */
function groupByBatch(transactions) {
  const map = {};
  transactions.forEach((tx) => {
    const key = `${tx.timestamp}__${tx.customerOrSource}`;
    if (!map[key]) {
      map[key] = {
        key,
        source:    tx.customerOrSource,
        timestamp: tx.timestamp,
        createdAt: tx.createdAt,
        items:     [],
      };
    }
    map[key].items.push(tx);
  });
  return Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─────────────────────────────────────────────
//  History Group Card
// ─────────────────────────────────────────────

function HistoryGroupCard({ group, productNames, getStockFor, onSaved, index }) {
  const totalUnits = group.items.reduce((s, t) => s + (t.quantity || 0), 0);
  const isOpening  = group.items.every((t) => t.type === ENTRY_TYPE.OPENING_STOCK);

  // ── Edit state ────────────────────────────
  const [expanded,     setExpanded]     = useState(false);
  const [editMode,     setEditMode]     = useState(false);
  const [editSource,   setEditSource]   = useState(group.source || '');
  const [editTs,       setEditTs]       = useState(group.timestamp || '');
  const [editItems,    setEditItems]    = useState(
    group.items.map((t) => makeEditItem(t.productName, t.quantity)),
  );
  const [tsError,      setTsError]      = useState('');
  const [globalError,  setGlobalError]  = useState('');

  // ── Modals ────────────────────────────────
  const [saveVisible,   setSaveVisible]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const pickedNames = editItems.map((i) => i.productName).filter(Boolean);

  // ── Derived stock: original qty gets "returned" so no false OOS ──
  const origQtyMap = {};
  group.items.forEach((t) => {
    origQtyMap[t.productName] = (origQtyMap[t.productName] || 0) + t.quantity;
  });

  // ── Edit item helpers ─────────────────────
  function addEditItem() {
    setEditItems((prev) => [...prev, makeEditItem(null, '')]);
    setGlobalError('');
  }

  function removeEditItem(key) {
    setEditItems((prev) => prev.filter((i) => i._key !== key));
    setGlobalError('');
  }

  function updateEditProduct(key, val) {
    setEditItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, productName: val, prodError: '', qtyError: '' } : i)),
    );
    setGlobalError('');
  }

  function updateEditQty(key, text) {
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setEditItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, quantity: cleaned, qtyError: '' } : i)),
    );
    setGlobalError('');
  }

  function setItemErr(key, field, msg) {
    setEditItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: msg } : i)),
    );
  }

  // ── Validation ────────────────────────────
  function validate() {
    let ok = true;
    setGlobalError('');
    setTsError('');

    if (!editTs.trim()) { setTsError('Date/time is required.'); ok = false; }

    if (editItems.length === 0) { setGlobalError('Add at least one product.'); ok = false; }

    const names  = editItems.map((i) => i.productName).filter(Boolean);
    if (names.length !== new Set(names).size) {
      setGlobalError('Each product can only appear once.');
      ok = false;
    }

    editItems.forEach((item) => {
      if (!item.productName) {
        setItemErr(item._key, 'prodError', 'Select a product.');
        ok = false;
      }
      const num = parseFloat(item.quantity);
      if (!item.quantity || isNaN(num) || num <= 0) {
        setItemErr(item._key, 'qtyError', 'Enter a quantity greater than 0.');
        ok = false;
      }
    });

    return ok;
  }

  // ── Save handler ──────────────────────────
  async function handleConfirmSave() {
    setSaving(true);
    try {
      const newItems = editItems.map((i) => ({
        productName: i.productName,
        quantity:    parseFloat(i.quantity),
      }));

      await updateRestockGroup(
        group.items.map((t) => ({ id: t.id, productName: t.productName, quantity: t.quantity })),
        newItems,
        editSource,
        editTs.trim(),
        group.createdAt,
      );

      setSaveVisible(false);
      setEditMode(false);
      onSaved();
    } catch (err) {
      setSaveVisible(false);
      setGlobalError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handler ────────────────────────
  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteRestockGroup(
        group.items.map((t) => ({ id: t.id, productName: t.productName, quantity: t.quantity })),
      );
      setDeleteVisible(false);
      onSaved();
    } catch (err) {
      setDeleteVisible(false);
      setGlobalError(err.message || 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  }

  const validEditItems = editItems.filter((i) => i.productName && parseFloat(i.quantity) > 0);
  const editTotal      = validEditItems.reduce((s, i) => s + parseFloat(i.quantity), 0);
  const availableToAdd = productNames.filter((n) => !pickedNames.includes(n));

  return (
    <View style={hStyles.card}>

      {/* ── Card header ───────────────────── */}
      <TouchableOpacity
        style={hStyles.cardHeader}
        onPress={() => { setExpanded((v) => !v); setEditMode(false); }}
        activeOpacity={0.8}
      >
        <View style={[hStyles.typeBadge, isOpening ? hStyles.typeBadgeOpening : hStyles.typeBadgeIn]}>
          <Text style={hStyles.typeBadgeText}>{isOpening ? '★' : '↑'}</Text>
        </View>
        <View style={hStyles.headerMid}>
          <Text style={hStyles.sourceText} numberOfLines={1}>
            {group.source || 'SUPPLIER'}
          </Text>
          <Text style={hStyles.timeText}>{group.timestamp}</Text>
        </View>
        <View style={hStyles.headerRight}>
          <Text style={hStyles.totalUnits}>+{totalUnits}</Text>
          <Text style={hStyles.totalSub}>{group.items.length} item{group.items.length !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={hStyles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* ── Expanded body ─────────────────── */}
      {expanded && (
        <View style={hStyles.body}>

          {!editMode ? (
            <>
              {/* Read-only product lines */}
              {group.items.map((tx, i) => (
                <View
                  key={tx.id}
                  style={[hStyles.productRow, i < group.items.length - 1 && hStyles.productRowBorder]}
                >
                  <Text style={hStyles.productName} numberOfLines={2}>{tx.productName}</Text>
                  <View style={hStyles.productRight}>
                    <Text style={hStyles.productQty}>+{tx.quantity}</Text>
                    <Text style={hStyles.productQtyLabel}>units</Text>
                  </View>
                </View>
              ))}

              {/* Action buttons */}
              {!isOpening && (
                <View style={hStyles.actionRow}>
                  <TouchableOpacity
                    style={hStyles.editBtn}
                    onPress={() => setEditMode(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={hStyles.editBtnText}>✏️  Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={hStyles.deleteBtn}
                    onPress={() => setDeleteVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={hStyles.deleteBtnText}>🗑️  Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              {isOpening && (
                <View style={hStyles.openingNote}>
                  <Text style={hStyles.openingNoteText}>
                    Opening stock entries cannot be edited here.
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* ── Edit mode ──────────────────── */
            <View style={{ zIndex: 100 }}>

              {!!globalError && (
                <View style={hStyles.errBanner}>
                  <Text style={hStyles.errBannerText}>{globalError}</Text>
                </View>
              )}

              {/* Source */}
              <Text style={hStyles.editLabel}>Source / Remarks</Text>
              <TextInput
                style={hStyles.editInput}
                value={editSource}
                onChangeText={setEditSource}
                placeholder="e.g. Head office, Batch #42…"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="sentences"
                maxLength={120}
              />

              {/* Timestamp */}
              <Text style={[hStyles.editLabel, { marginTop: 10 }, !!tsError && hStyles.editLabelErr]}>
                Date / Time *
              </Text>
              <TextInput
                style={[hStyles.editInput, !!tsError && hStyles.editInputErr]}
                value={editTs}
                onChangeText={(t) => { setEditTs(t); setTsError(''); }}
                placeholder="DD-MMM-YYYY H:MM AM/PM"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                maxLength={30}
              />
              {!!tsError && <Text style={hStyles.errText}>{tsError}</Text>}

              {/* Edit items */}
              <Text style={[hStyles.editLabel, { marginTop: 12 }]}>Products</Text>

              {editItems.map((item, idx) => (
                <View
                  key={item._key}
                  style={[hStyles.editItemRow, { zIndex: 500 - idx * 20, elevation: 500 - idx * 20 }]}
                >
                  <View style={hStyles.editItemHeader}>
                    <Text style={hStyles.editItemNum}>{idx + 1}</Text>
                    {editItems.length > 1 && (
                      <TouchableOpacity
                        style={hStyles.removeEditBtn}
                        onPress={() => removeEditItem(item._key)}
                      >
                        <Text style={hStyles.removeEditBtnText}>✕ Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ProductDropdown
                    mode="single"
                    items={productNames.filter((n) => !pickedNames.includes(n) || n === item.productName)}
                    value={item.productName}
                    onValueChange={(val) => updateEditProduct(item._key, val)}
                    label="Product"
                    placeholder="Select product…"
                    error={item.prodError}
                    zIndex={500 - idx * 20}
                    zIndexInverse={200}
                  />

                  <TextInput
                    style={[
                      hStyles.editInput,
                      { marginTop: 8 },
                      !!item.qtyError && hStyles.editInputErr,
                      !item.productName && hStyles.editInputDisabled,
                    ]}
                    value={item.quantity}
                    onChangeText={(val) => updateEditQty(item._key, val)}
                    placeholder={item.productName ? 'Quantity' : 'Select product first'}
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                    editable={!!item.productName}
                    maxLength={8}
                  />
                  {!!item.qtyError && <Text style={hStyles.errText}>{item.qtyError}</Text>}
                </View>
              ))}

              {/* Add product */}
              <TouchableOpacity
                style={[hStyles.addItemBtn, availableToAdd.length === 0 && hStyles.addItemBtnDisabled]}
                onPress={addEditItem}
                disabled={availableToAdd.length === 0}
              >
                <Text style={hStyles.addItemBtnText}>
                  {availableToAdd.length === 0 ? 'All products added' : '＋ Add Product'}
                </Text>
              </TouchableOpacity>

              {/* Total */}
              {editTotal > 0 && (
                <View style={hStyles.editTotal}>
                  <Text style={hStyles.editTotalLabel}>Total units</Text>
                  <Text style={hStyles.editTotalValue}>+{editTotal}</Text>
                </View>
              )}

              {/* Edit action buttons */}
              <View style={hStyles.editActionRow}>
                <TouchableOpacity
                  style={hStyles.cancelEditBtn}
                  onPress={() => {
                    setEditMode(false);
                    setGlobalError('');
                    // Reset to original
                    setEditSource(group.source || '');
                    setEditTs(group.timestamp || '');
                    setEditItems(group.items.map((t) => makeEditItem(t.productName, t.quantity)));
                  }}
                >
                  <Text style={hStyles.cancelEditBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={hStyles.saveEditBtn}
                  onPress={() => { Keyboard.dismiss(); if (validate()) setSaveVisible(true); }}
                >
                  <Text style={hStyles.saveEditBtnText}>💾 Save Changes</Text>
                </TouchableOpacity>
              </View>

              {/* Delete from edit mode too */}
              <TouchableOpacity
                style={hStyles.deleteFromEdit}
                onPress={() => setDeleteVisible(true)}
              >
                <Text style={hStyles.deleteFromEditText}>🗑️  Delete This Arrival</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Save confirm modal ──────────────── */}
      <ConfirmModal
        visible={saveVisible}
        title="Save Changes?"
        message={`Updating stock arrival from "${editSource || 'SUPPLIER'}" dated ${editTs}.`}
        confirmLabel="Save"
        cancelLabel="Cancel"
        confirmColor={COLORS.success}
        onConfirm={handleConfirmSave}
        onCancel={() => !saving && setSaveVisible(false)}
        loading={saving}
      >
        <View style={hStyles.modalSummary}>
          <View style={[hStyles.modalRow, hStyles.modalHeader]}>
            <Text style={[hStyles.modalCol, hStyles.modalHeaderText]}>Product</Text>
            <Text style={[hStyles.modalColRight, hStyles.modalHeaderText]}>Qty</Text>
          </View>
          {validEditItems.map((item, i) => (
            <View key={item._key} style={[hStyles.modalRow, i < validEditItems.length - 1 && hStyles.modalRowBorder]}>
              <Text style={hStyles.modalCol} numberOfLines={2}>{item.productName}</Text>
              <Text style={[hStyles.modalColRight, hStyles.modalQty]}>+{item.quantity}</Text>
            </View>
          ))}
        </View>
      </ConfirmModal>

      {/* ── Delete confirm modal ─────────────── */}
      <ConfirmModal
        visible={deleteVisible}
        title="Delete Stock Arrival?"
        message={
          `This will remove all ${group.items.length} product${group.items.length !== 1 ? 's' : ''} ` +
          `in this arrival and reverse their stock. This cannot be undone.`
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        confirmColor={COLORS.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteVisible(false)}
        loading={deleting}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function RestockScreen() {
  const { productNames, getStockFor, refreshProducts } = useAppContext();

  // ── Form state ────────────────────────────
  const [items,        setItems]        = useState([newItem()]);
  const [source,       setSource]       = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [lastRestock,  setLastRestock]  = useState(null);
  const [globalError,  setGlobalError]  = useState('');

  // ── History state ─────────────────────────
  const [historyGroups,  setHistoryGroups]  = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistory,    setShowHistory]    = useState(true);

  // ── Load history ──────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const all = await getAllTransactions();
      const stockEntries = all.filter(
        (t) => t.type === ENTRY_TYPE.STOCK_IN || t.type === ENTRY_TYPE.OPENING_STOCK,
      );
      setHistoryGroups(groupByBatch(stockEntries));
    } catch (err) {
      console.error('RestockScreen history error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadHistory(); }, [loadHistory]),
  );

  // ── Item helpers ──────────────────────────
  function addItem() {
    setItems((prev) => [...prev, newItem()]);
    setLastRestock(null);
  }

  function removeItem(id) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, [field]: value, [`${field === 'productName' ? 'product' : 'qty'}Error`]: '' }
          : i,
      ),
    );
    setLastRestock(null);
    setGlobalError('');
  }

  function setItemError(id, field, msg) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [`${field}Error`]: msg } : i)),
    );
  }

  // ── Validation ────────────────────────────
  function validateAll() {
    let valid = true;
    const selected = items.map((i) => i.productName).filter(Boolean);
    if (selected.length !== new Set(selected).size) {
      setGlobalError('Each product can only appear once. Remove duplicates.');
      valid = false;
    } else {
      setGlobalError('');
    }

    items.forEach((item) => {
      if (!item.productName) {
        setItemError(item.id, 'product', 'Please select a product.');
        valid = false;
      }
      if (!item.qty || isNaN(parseFloat(item.qty)) || parseFloat(item.qty) <= 0) {
        setItemError(item.id, 'qty', 'Enter a quantity greater than 0.');
        valid = false;
      }
    });

    return valid;
  }

  // ── Submit ────────────────────────────────
  function handlePreview() {
    Keyboard.dismiss();
    if (!validateAll()) return;
    setModalVisible(true);
  }

  async function handleConfirm() {
    setSaving(true);
    const results = [];
    const errors  = [];

    try {
      for (const item of items) {
        try {
          await processRestock(item.productName, item.qty, source);
          results.push({ product: item.productName, qty: parseFloat(item.qty) });
        } catch (err) {
          errors.push(`${item.productName}: ${err.message}`);
        }
      }

      await refreshProducts();
      await loadHistory();

      if (results.length > 0) {
        setLastRestock({ items: results, source: source.trim() || 'SUPPLIER' });
      }
      if (errors.length > 0) {
        setGlobalError(errors.join('\n'));
      }

      setItems([newItem()]);
      setSource('');
      setModalVisible(false);
    } catch (err) {
      setGlobalError(err.message || 'Failed to record restock.');
      setModalVisible(false);
    } finally {
      setSaving(false);
    }
  }

  const validItems = items.filter((i) => i.productName && parseFloat(i.qty) > 0);
  const canSubmit  = validItems.length > 0;
  const totalUnits = validItems.reduce((s, i) => s + parseFloat(i.qty), 0);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >

        {/* ── Success banner ──────────────── */}
        {lastRestock && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✅</Text>
            <View style={styles.successTextGroup}>
              <Text style={styles.successTitle}>Stock Updated!</Text>
              {lastRestock.items.map((r) => (
                <Text key={r.product} style={styles.successMsg}>
                  +<Text style={styles.bold}>{r.qty}</Text> → <Text style={styles.bold}>{r.product}</Text>
                </Text>
              ))}
            </View>
          </View>
        )}

        {!!globalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{globalError}</Text>
          </View>
        )}

        {/* ── Product rows ──────────────────── */}
        {items.map((item, index) => (
          <RestockItemRow
            key={item.id}
            item={item}
            index={index}
            productNames={productNames}
            getStockFor={getStockFor}
            totalItems={items.length}
            zIndex={3000 - index * 100}
            onProductChange={(val) => updateItem(item.id, 'productName', val)}
            onQtyChange={(val)     => updateItem(item.id, 'qty', val)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <TouchableOpacity style={styles.addRowBtn} onPress={addItem} activeOpacity={0.8}>
          <Text style={styles.addRowIcon}>＋</Text>
          <Text style={styles.addRowText}>Add Another Product</Text>
        </TouchableOpacity>

        {/* ── Source ────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Source / Remarks <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={source}
            onChangeText={setSource}
            placeholder="e.g. Head office, Batch #42, Supplier name…"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="sentences"
            multiline
            numberOfLines={2}
            maxLength={120}
            returnKeyType="done"
            blurOnSubmit
          />
          <Text style={styles.hint}>Applied to all products in this restock</Text>
        </View>

        {canSubmit && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryLabel}>
              {validItems.length} product{validItems.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.summaryDivider}>·</Text>
            <Text style={styles.summaryValue}>{totalUnits} units total</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          <Text style={styles.submitIcon}>🚚</Text>
          <Text style={styles.submitText}>Confirm Stock In</Text>
        </TouchableOpacity>

        {/* ═══════════════════════════════════
            PREVIOUS STOCK ARRIVALS (GROUPED)
        ════════════════════════════════════ */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>PREVIOUS STOCK ARRIVALS</Text>
          <View style={styles.sectionLine} />
        </View>

        <TouchableOpacity
          style={styles.historyHeader}
          onPress={() => setShowHistory((v) => !v)}
          activeOpacity={0.75}
        >
          <View>
            <Text style={styles.historyHeaderTitle}>
              {historyLoading
                ? 'Loading…'
                : `${historyGroups.length} batch${historyGroups.length !== 1 ? 'es' : ''}`}
            </Text>
            <Text style={styles.historyHeaderSub}>
              Tap a batch to view, edit, or delete
            </Text>
          </View>
          <Text style={styles.historyToggle}>
            {showHistory ? '▲ Hide' : '▼ Show'}
          </Text>
        </TouchableOpacity>

        {showHistory && (
          historyLoading ? (
            <View style={styles.historyLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.historyLoadingText}>Loading history…</Text>
            </View>
          ) : historyGroups.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Text style={styles.historyEmptyIcon}>📭</Text>
              <Text style={styles.historyEmptyText}>No stock arrivals recorded yet</Text>
            </View>
          ) : (
            historyGroups.map((group, i) => (
              <HistoryGroupCard
                key={group.key}
                group={group}
                index={i}
                productNames={productNames}
                getStockFor={getStockFor}
                onSaved={async () => {
                  await refreshProducts();
                  await loadHistory();
                }}
              />
            ))
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm Stock In modal ──────────── */}
      <ConfirmModal
        visible={modalVisible}
        title="Confirm Stock Arrival?"
        message={`Adding stock for ${validItems.length} product${validItems.length !== 1 ? 's' : ''}. Changes are immediate.`}
        confirmLabel="Confirm Stock In"
        cancelLabel="Go Back"
        confirmColor={COLORS.success}
        onConfirm={handleConfirm}
        onCancel={() => !saving && setModalVisible(false)}
        loading={saving}
      >
        <View style={styles.modalSummary}>
          <View style={[styles.modalRow, styles.modalHeader]}>
            <Text style={[styles.modalCol, styles.modalHeaderText]}>Product</Text>
            <Text style={[styles.modalColRight, styles.modalHeaderText]}>Qty In</Text>
            <Text style={[styles.modalColRight, styles.modalHeaderText]}>After</Text>
          </View>
          {validItems.map((item, i) => {
            const before = getStockFor(item.productName);
            const qty    = parseFloat(item.qty);
            const after  = before + qty;
            return (
              <View
                key={item.id}
                style={[styles.modalRow, i < validItems.length - 1 && styles.modalRowBorder]}
              >
                <Text style={styles.modalCol} numberOfLines={2}>{item.productName}</Text>
                <Text style={[styles.modalColRight, styles.modalQty]}>+{qty}</Text>
                <Text style={[styles.modalColRight, styles.modalAfter]}>{after}</Text>
              </View>
            );
          })}
          <View style={[styles.modalRow, styles.modalTotalRow]}>
            <Text style={styles.modalTotalLabel}>Total Units</Text>
            <Text style={styles.modalTotalValue}>{totalUnits}</Text>
          </View>
        </View>
      </ConfirmModal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  RestockItemRow (new stock form)
// ─────────────────────────────────────────────

function RestockItemRow({
  item, index, productNames, getStockFor,
  totalItems, zIndex,
  onProductChange, onQtyChange, onRemove,
}) {
  const currentStock = item.productName ? getStockFor(item.productName) : null;
  const qtyNum       = parseFloat(item.qty) || 0;
  const stockAfter   = currentStock !== null ? currentStock + qtyNum : null;

  return (
    <View style={[styles.card, { zIndex, elevation: zIndex }]}>
      <View style={styles.rowHeader}>
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.rowLabel}>Product {index + 1}</Text>
        {totalItems > 1 && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeBtnText}>✕ Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      <ProductDropdown
        mode="single"
        items={productNames}
        value={item.productName}
        onValueChange={onProductChange}
        label="Product"
        placeholder="Select a product…"
        error={item.productError}
        zIndex={zIndex}
        zIndexInverse={500}
      />

      {item.productName && (
        <View style={[styles.stockStrip, currentStock === 0 && styles.stockStripEmpty]}>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>Current</Text>
            <Text style={[styles.stockValue, currentStock === 0 && styles.stockValueEmpty]}>
              {currentStock}
            </Text>
          </View>
          <Text style={styles.stockArrow}>＋{qtyNum || 0}</Text>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>After</Text>
            <Text style={[styles.stockValue, styles.stockValueAfter]}>{stockAfter}</Text>
          </View>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, !!item.qtyError && styles.fieldLabelError]}>
          Quantity Received <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            !!item.qtyError    && styles.inputError,
            !item.productName  && styles.inputDisabled,
          ]}
          value={item.qty}
          onChangeText={onQtyChange}
          placeholder={item.productName ? 'Enter quantity' : 'Select a product first'}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="decimal-pad"
          returnKeyType="done"
          editable={!!item.productName}
          maxLength={8}
        />
        {!!item.qtyError && <Text style={styles.errorText}>{item.qtyError}</Text>}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles — main screen
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  successBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#E8F5E9', borderRadius: 12,
    borderLeftWidth: 4, borderLeftColor: COLORS.success,
    padding: 14, marginBottom: 14, gap: 12,
  },
  successIcon:      { fontSize: 22 },
  successTextGroup: { flex: 1 },
  successTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.success, marginBottom: 3 },
  successMsg:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20 },
  bold:             { fontWeight: '700' },

  errorBanner: {
    backgroundColor: '#FFEBEE', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.error,
    padding: 12, marginBottom: 12,
  },
  errorBannerText: { fontSize: 13, color: COLORS.error, lineHeight: 20 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },

  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  rowBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center',
  },
  rowBadgeText:  { fontSize: 12, fontWeight: '800', color: COLORS.surface },
  rowLabel:      { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  removeBtn:     { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFEBEE', borderRadius: 6 },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  stockStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16, marginVertical: 10,
  },
  stockStripEmpty: { backgroundColor: '#FFF3E0' },
  stockItem:       { flex: 1, alignItems: 'center' },
  stockLabel:      { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  stockValue:      { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  stockValueEmpty: { color: COLORS.error },
  stockValueAfter: { color: COLORS.success },
  stockArrow:      { fontSize: 15, fontWeight: '700', color: COLORS.success, paddingHorizontal: 8 },

  fieldGroup:      { marginTop: 8 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldLabelError: { color: COLORS.error },
  required:        { color: COLORS.error },
  optional:        { fontSize: 12, fontWeight: '400', color: COLORS.textSecondary },

  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError:    { borderColor: COLORS.error },
  inputDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', color: COLORS.textSecondary },
  errorText:     { marginTop: 5, fontSize: 12, color: COLORS.error, fontWeight: '500' },
  hint:          { marginTop: 5, fontSize: 11, color: COLORS.textSecondary },

  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.success, borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, marginBottom: 12, gap: 8,
  },
  addRowIcon: { fontSize: 18, color: COLORS.success, fontWeight: '700' },
  addRowText: { fontSize: 15, fontWeight: '700', color: COLORS.success },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 10, paddingVertical: 10,
    marginBottom: 12, gap: 8,
  },
  summaryLabel:   { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  summaryDivider: { color: COLORS.textSecondary },
  summaryValue:   { fontSize: 15, fontWeight: '800', color: COLORS.success },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 15, gap: 10,
    shadowColor: COLORS.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  submitIcon: { fontSize: 18 },
  submitText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  sectionDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 28, marginBottom: 14, gap: 10,
  },
  sectionLine:  { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1.0 },

  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  historyHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  historyHeaderSub:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  historyToggle:      { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  historyLoadingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 24, gap: 10,
  },
  historyLoadingText: { fontSize: 13, color: COLORS.textSecondary },

  historyEmpty:     { paddingVertical: 32, alignItems: 'center' },
  historyEmptyIcon: { fontSize: 32, marginBottom: 8 },
  historyEmptyText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  // ── Modal ─────────────────────────────────
  modalSummary: { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalHeader:  { backgroundColor: '#E8EEF8' },
  modalHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  modalRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  modalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalCol:       { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalColRight:  { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right', color: COLORS.textPrimary },
  modalQty:       { color: COLORS.success, fontWeight: '700' },
  modalAfter:     { color: COLORS.primary, fontWeight: '700' },
  modalTotalRow:  { borderTopWidth: 1.5, borderTopColor: '#D0D0D0', backgroundColor: '#ECEEF5' },
  modalTotalLabel: { flex: 2, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  modalTotalValue: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.success, textAlign: 'right' },
});

// ─────────────────────────────────────────────
//  Styles — HistoryGroupCard
// ─────────────────────────────────────────────

const hStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10,
  },
  typeBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadgeIn:      { backgroundColor: '#E8F5E9' },
  typeBadgeOpening: { backgroundColor: '#EEF2FF' },
  typeBadgeText:    { fontSize: 16, fontWeight: '800', color: COLORS.success },

  headerMid:  { flex: 1 },
  sourceText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  timeText:   { fontSize: 11, color: COLORS.textSecondary },

  headerRight:  { alignItems: 'flex-end', marginRight: 4 },
  totalUnits:   { fontSize: 18, fontWeight: '800', color: COLORS.success },
  totalSub:     { fontSize: 10, color: COLORS.textSecondary },
  chevron:      { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },

  body: { paddingHorizontal: 14, paddingBottom: 14 },

  productRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
  },
  productRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  productName:      { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, lineHeight: 18 },
  productRight:     { alignItems: 'flex-end', minWidth: 48 },
  productQty:       { fontSize: 15, fontWeight: '800', color: COLORS.success },
  productQtyLabel:  { fontSize: 10, color: COLORS.textSecondary },

  actionRow:   { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn: {
    flex: 1, paddingVertical: 10, backgroundColor: '#E8F0FE',
    borderRadius: 8, alignItems: 'center',
  },
  editBtnText:   { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  deleteBtn: {
    flex: 1, paddingVertical: 10, backgroundColor: '#FFEBEE',
    borderRadius: 8, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.error },

  openingNote: {
    marginTop: 10, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 10,
  },
  openingNoteText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },

  // Edit mode
  errBanner: {
    backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errBannerText: { fontSize: 13, color: COLORS.error },

  editLabel:    { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 5 },
  editLabelErr: { color: COLORS.error },
  editInput: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  editInputErr:      { borderColor: COLORS.error },
  editInputDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', color: COLORS.textSecondary },
  errText: { marginTop: 4, fontSize: 12, color: COLORS.error, fontWeight: '500' },

  editItemRow:   { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  editItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  editItemNum:   { fontSize: 13, fontWeight: '800', color: COLORS.success, width: 20 },
  removeEditBtn: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FFEBEE', borderRadius: 6 },
  removeEditBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.success, borderStyle: 'dashed',
    borderRadius: 8, paddingVertical: 10, marginTop: 12,
  },
  addItemBtnDisabled: { borderColor: '#BDBDBD' },
  addItemBtnText:     { fontSize: 13, fontWeight: '700', color: COLORS.success },

  editTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.success + '40',
  },
  editTotalLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  editTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.success },

  editActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelEditBtn: {
    flex: 1, paddingVertical: 11, borderWidth: 1.5, borderColor: '#BDBDBD',
    borderRadius: 8, alignItems: 'center',
  },
  cancelEditBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  saveEditBtn: {
    flex: 2, paddingVertical: 11, backgroundColor: COLORS.success,
    borderRadius: 8, alignItems: 'center',
  },
  saveEditBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.surface },

  deleteFromEdit: {
    marginTop: 10, paddingVertical: 11, backgroundColor: '#FFEBEE',
    borderRadius: 8, alignItems: 'center',
  },
  deleteFromEditText: { fontSize: 13, fontWeight: '700', color: COLORS.error },

  // Modal summary (inside HistoryGroupCard modals)
  modalSummary:    { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalHeader:     { backgroundColor: '#E8EEF8' },
  modalHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  modalRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  modalRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalCol:        { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalColRight:   { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right', color: COLORS.textPrimary },
  modalQty:        { color: COLORS.success, fontWeight: '700' },
});