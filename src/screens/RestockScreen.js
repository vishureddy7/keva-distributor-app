// ─────────────────────────────────────────────
//  RestockScreen.js  (UPDATED)
//  Supports restocking MULTIPLE products at once.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
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
} from 'react-native';

import { useAppContext }   from '../context/AppContext';
import { processRestock } from '../services/stockService';
import ProductDropdown    from '../components/ProductDropdown';
import ConfirmModal       from '../components/ConfirmModal';
import { COLORS }         from '../utils/constants';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

let _id = 1;
const newItem = () => ({ id: String(_id++), productName: null, qty: '', productError: '', qtyError: '' });

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function RestockScreen() {
  const { productNames, getStockFor, refreshProducts } = useAppContext();

  const [items,        setItems]        = useState([newItem()]);
  const [source,       setSource]       = useState('');   // global source/remarks
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [lastRestock,  setLastRestock]  = useState(null);
  const [globalError,  setGlobalError]  = useState('');

  // ── Item helpers ──────────────────────────
  function addItem() {
    setItems(prev => [...prev, newItem()]);
    setLastRestock(null);
  }

  function removeItem(id) {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }

  function updateItem(id, field, value) {
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, [field]: value, [`${field.replace('Name', '').replace('ty', 'ty')}Error`]: '' }
        : i
    ));
    setLastRestock(null);
    setGlobalError('');
  }

  function setItemError(id, field, msg) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [`${field}Error`]: msg } : i));
  }

  // ── Validation ────────────────────────────
  function validateAll() {
    let valid = true;

    // Check no duplicate product selections
    const selected = items.map(i => i.productName).filter(Boolean);
    const hasDupe  = selected.length !== new Set(selected).size;
    if (hasDupe) {
      setGlobalError('Each product can only appear once. Remove duplicates.');
      valid = false;
    } else {
      setGlobalError('');
    }

    items.forEach(item => {
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

  // ── Submit flow ───────────────────────────
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

      if (results.length > 0) {
        setLastRestock({ items: results, source: source.trim() || 'SUPPLIER' });
      }
      if (errors.length > 0) {
        setGlobalError(errors.join('\n'));
      }

      // Reset form
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

  // ── Derived ───────────────────────────────
  const validItems   = items.filter(i => i.productName && parseFloat(i.qty) > 0);
  const canSubmit    = validItems.length > 0;
  const totalUnits   = validItems.reduce((s, i) => s + parseFloat(i.qty), 0);

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
              {lastRestock.items.map(r => (
                <Text key={r.product} style={styles.successMsg}>
                  + <Text style={styles.bold}>{r.qty}</Text> → <Text style={styles.bold}>{r.product}</Text>
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* ── Global error ─────────────────── */}
        {!!globalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{globalError}</Text>
          </View>
        )}

        {/* ── Product rows ─────────────────── */}
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
            onQtyChange={(val) => updateItem(item.id, 'qty', val)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        {/* ── Add another row ──────────────── */}
        <TouchableOpacity style={styles.addRowBtn} onPress={addItem} activeOpacity={0.8}>
          <Text style={styles.addRowIcon}>＋</Text>
          <Text style={styles.addRowText}>Add Another Product</Text>
        </TouchableOpacity>

        {/* ── Source / Remarks ─────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Source / Remarks  <Text style={styles.optional}>(optional)</Text></Text>
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

        {/* ── Summary footer ───────────────── */}
        {canSubmit && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryLabel}>{validItems.length} product{validItems.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryDivider}>·</Text>
            <Text style={styles.summaryValue}>{totalUnits} units total</Text>
          </View>
        )}

        {/* ── Submit ───────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          <Text style={styles.submitIcon}>🚚</Text>
          <Text style={styles.submitText}>Confirm Stock In</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm modal ─────────────────── */}
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
              <View key={item.id} style={[styles.modalRow, i < validItems.length - 1 && styles.modalRowBorder]}>
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
//  RestockItemRow
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
      {/* Row header */}
      <View style={styles.rowHeader}>
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.rowLabel}>Product {index + 1}</Text>
        {totalItems > 1 && (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.removeBtnText}>✕ Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Product picker */}
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

      {/* Stock preview strip */}
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

      {/* Qty input */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, !!item.qtyError && styles.fieldLabelError]}>
          Quantity Received <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, !!item.qtyError && styles.inputError, !item.productName && styles.inputDisabled]}
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
//  Styles
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
  rowBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.surface },
  rowLabel:     { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  removeBtn:    { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFEBEE', borderRadius: 6 },
  removeBtnText:{ fontSize: 12, fontWeight: '700', color: COLORS.error },

  stockStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16,
    marginVertical: 10,
  },
  stockStripEmpty: { backgroundColor: '#FFF3E0' },
  stockItem:  { flex: 1, alignItems: 'center' },
  stockLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  stockValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  stockValueEmpty: { color: COLORS.error },
  stockValueAfter: { color: COLORS.success },
  stockArrow: { fontSize: 15, fontWeight: '700', color: COLORS.success, paddingHorizontal: 8 },

  fieldGroup: { marginTop: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldLabelError: { color: COLORS.error },
  required:   { color: COLORS.error },
  optional:   { fontSize: 12, fontWeight: '400', color: COLORS.textSecondary },

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

  modalSummary: { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalHeader:  { backgroundColor: '#E8EEF8' },
  modalHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  modalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalCol:      { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalColRight: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right', color: COLORS.textPrimary },
  modalQty:      { color: COLORS.success, fontWeight: '700' },
  modalAfter:    { color: COLORS.primary, fontWeight: '700' },
  modalTotalRow: { borderTopWidth: 1.5, borderTopColor: '#D0D0D0', backgroundColor: '#ECEEF5' },
  modalTotalLabel: { flex: 2, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  modalTotalValue: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.success, textAlign: 'right' },
});