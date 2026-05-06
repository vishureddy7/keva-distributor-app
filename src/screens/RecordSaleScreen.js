// ─────────────────────────────────────────────
//  RecordSaleScreen.js
//
//  CHANGES:
//   • Each product in the "Enter Quantities" section
//     now has a red "✕ Remove" button so the user can
//     drop a product without reopening the dropdown.
// ─────────────────────────────────────────────

import React, { useState, useRef } from 'react';
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

import { useAppContext }  from '../context/AppContext';
import { processSale }   from '../services/stockService';
import ProductDropdown   from '../components/ProductDropdown';
import QuantityInput     from '../components/QuantityInput';
import ConfirmModal      from '../components/ConfirmModal';
import { COLORS }        from '../utils/constants';
import {
  validateCustomerName,
  validateSaleQuantity,
} from '../utils/validators';

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function RecordSaleScreen() {
  const { productNames, getStockFor, refreshProducts } = useAppContext();

  // ── Form state ────────────────────────────
  const [customerName,   setCustomerName]   = useState('');
  const [selectedProds,  setSelectedProds]  = useState([]);   // string[]
  const [quantities,     setQuantities]     = useState({});   // { productName: string }
  const [customerError,  setCustomerError]  = useState('');
  const [productError,   setProductError]   = useState('');
  const [qtyErrors,      setQtyErrors]      = useState({});   // { productName: string }

  // ── Modal / save state ────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);

  // ── Success state ─────────────────────────
  const [lastSale, setLastSale] = useState(null);

  const customerInputRef = useRef(null);

  // ─────────────────────────────────────────
  //  Handlers — form fields
  // ─────────────────────────────────────────

  function handleCustomerChange(text) {
    setCustomerName(text);
    if (customerError) setCustomerError('');
    if (lastSale)      setLastSale(null);
  }

  function handleProductsChange(values) {
    const newValues = values || [];
    setSelectedProds(newValues);
    setProductError('');
    setLastSale(null);

    // Clean up quantities for de-selected products
    setQuantities((prev) => {
      const next = {};
      newValues.forEach((name) => { next[name] = prev[name] ?? ''; });
      return next;
    });

    // Clean up qty errors
    setQtyErrors((prev) => {
      const next = {};
      newValues.forEach((name) => { if (prev[name]) next[name] = prev[name]; });
      return next;
    });
  }

  // ── Remove a single product from the list ─
  function handleRemoveProduct(productName) {
    const newValues = selectedProds.filter((p) => p !== productName);
    handleProductsChange(newValues);
  }

  function handleQtyChange(productName, text) {
    setQuantities((prev) => ({ ...prev, [productName]: text }));
    setQtyErrors((prev) => ({ ...prev, [productName]: '' }));
  }

  // ─────────────────────────────────────────
  //  Validation
  // ─────────────────────────────────────────

  function validateAll() {
    let valid = true;

    const nameCheck = validateCustomerName(customerName);
    if (!nameCheck.valid) {
      setCustomerError(nameCheck.error);
      valid = false;
    } else {
      setCustomerError('');
    }

    if (selectedProds.length === 0) {
      setProductError('Please select at least one product.');
      valid = false;
    } else {
      setProductError('');
    }

    const newQtyErrors = {};
    selectedProds.forEach((name) => {
      const stock = getStockFor(name);
      const check = validateSaleQuantity(quantities[name] ?? '', stock);
      if (!check.valid) {
        newQtyErrors[name] = check.error;
        valid = false;
      }
    });
    setQtyErrors(newQtyErrors);

    return valid;
  }

  // ─────────────────────────────────────────
  //  Submit flow
  // ─────────────────────────────────────────

  function handlePreview() {
    Keyboard.dismiss();
    if (!validateAll()) return;
    setModalVisible(true);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const items = selectedProds.map((name) => ({
        productName:  name,
        qty:          Number(quantities[name]),
        currentStock: getStockFor(name),
      }));

      await processSale(customerName.trim(), items);
      await refreshProducts();

      setLastSale({
        customer: customerName.trim(),
        items:    items.map(({ productName, qty }) => ({ productName, qty })),
      });

      // Reset form
      setCustomerName('');
      setSelectedProds([]);
      setQuantities({});
      setCustomerError('');
      setProductError('');
      setQtyErrors({});
      setModalVisible(false);
    } catch (err) {
      setModalVisible(false);
      setCustomerError(err.message || 'Failed to record sale. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!saving) setModalVisible(false);
  }

  // ─────────────────────────────────────────
  //  Derived
  // ─────────────────────────────────────────

  const totalUnits = selectedProds.reduce(
    (sum, name) => sum + (parseFloat(quantities[name]) || 0),
    0,
  );

  const canSubmit = customerName.trim().length >= 2 && selectedProds.length > 0;

  // ─────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────

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
        {lastSale && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✅</Text>
            <View style={styles.successTextGroup}>
              <Text style={styles.successTitle}>Sale Recorded!</Text>
              <Text style={styles.successMsg}>
                Sale for{' '}
                <Text style={styles.bold}>"{lastSale.customer}"</Text>
                {' '}saved —{' '}
                {lastSale.items.map((item, i) => (
                  <Text key={item.productName}>
                    <Text style={styles.bold}>{item.qty}× {item.productName}</Text>
                    {i < lastSale.items.length - 1 ? ', ' : ''}
                  </Text>
                ))}
              </Text>
            </View>
          </View>
        )}

        {/* ── SECTION 1: Customer ─────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionStep}>1</Text>
            <Text style={styles.sectionTitle}>Customer Details</Text>
          </View>

          <Text style={[styles.label, !!customerError && styles.labelError]}>
            Customer Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            ref={customerInputRef}
            style={[styles.input, !!customerError && styles.inputError]}
            value={customerName}
            onChangeText={handleCustomerChange}
            placeholder="e.g. Ramesh Traders"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            returnKeyType="next"
          />
          {!!customerError && (
            <Text style={styles.errorText}>{customerError}</Text>
          )}
        </View>

        {/* ── SECTION 2: Products ─────────── */}
        <View style={[styles.sectionCard, { zIndex: 2000, elevation: 2000 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionStep}>2</Text>
            <Text style={styles.sectionTitle}>Select Products</Text>
          </View>

          <ProductDropdown
            mode="multi"
            items={productNames}
            value={selectedProds}
            onValueChange={handleProductsChange}
            label="Products"
            placeholder="Tap to select products…"
            error={productError}
            zIndex={2000}
            zIndexInverse={1000}
          />
        </View>

        {/* ── SECTION 3: Quantities ───────── */}
        {selectedProds.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionStep}>3</Text>
              <Text style={styles.sectionTitle}>Enter Quantities</Text>
            </View>

            {selectedProds.map((name, index) => {
              const stock = getStockFor(name);
              return (
                <View
                  key={name}
                  style={[
                    styles.productQtyBlock,
                    index < selectedProds.length - 1 && styles.productQtyBlockBorder,
                  ]}
                >
                  {/* Product name row + remove button */}
                  <View style={styles.productNameRow}>
                    <View style={styles.productIndexBadge}>
                      <Text style={styles.productIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>
                      {name}
                    </Text>
                    {/* ── Remove button ── */}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveProduct(name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.removeBtnText}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quantity input */}
                  <QuantityInput
                    value={quantities[name] ?? ''}
                    onChangeText={(text) => handleQtyChange(name, text)}
                    currentStock={stock}
                    label="Quantity to sell"
                    error={qtyErrors[name] || ''}
                    style={styles.qtyInput}
                  />
                </View>
              );
            })}

            {/* Sale summary footer */}
            {totalUnits > 0 && (
              <View style={styles.saleSummaryFooter}>
                <Text style={styles.saleSummaryLabel}>Total Units</Text>
                <Text style={styles.saleSummaryValue}>{totalUnits}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Submit button ───────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          <Text style={styles.submitIcon}>📦</Text>
          <Text style={styles.submitText}>Confirm Sale</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm modal ─────────────────────── */}
      <ConfirmModal
        visible={modalVisible}
        title="Confirm Sale?"
        message={`Recording sale for "${customerName.trim()}". Stock will be deducted immediately.`}
        confirmLabel="Record Sale"
        cancelLabel="Go Back"
        confirmColor={COLORS.primary}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        loading={saving}
      >
        {/* Sale items summary */}
        <View style={styles.modalSummary}>
          <View style={[styles.modalSummaryRow, styles.modalSummaryHeader]}>
            <Text style={[styles.modalSummaryCol, styles.modalHeaderText]}>Product</Text>
            <Text style={[styles.modalSummaryColRight, styles.modalHeaderText]}>Qty</Text>
            <Text style={[styles.modalSummaryColRight, styles.modalHeaderText]}>After</Text>
          </View>

          {selectedProds.map((name, i) => {
            const qty   = parseFloat(quantities[name]) || 0;
            const stock = getStockFor(name);
            const after = stock - qty;
            const isLast = i === selectedProds.length - 1;
            return (
              <View
                key={name}
                style={[
                  styles.modalSummaryRow,
                  !isLast && styles.modalSummaryRowBorder,
                ]}
              >
                <Text style={styles.modalSummaryCol} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={[styles.modalSummaryColRight, styles.modalQty]}>
                  −{qty}
                </Text>
                <Text style={[
                  styles.modalSummaryColRight,
                  after <= 0 ? styles.modalAfterEmpty : styles.modalAfterOk,
                ]}>
                  {after}
                </Text>
              </View>
            );
          })}

          <View style={[styles.modalSummaryRow, styles.modalTotalRow]}>
            <Text style={styles.modalTotalLabel}>Total Units Sold</Text>
            <Text style={styles.modalTotalValue}>{totalUnits}</Text>
          </View>
        </View>
      </ConfirmModal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  // ── Success banner ────────────────────────
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

  // ── Section card ──────────────────────────
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10,
  },
  sectionStep: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, color: COLORS.surface,
    fontSize: 13, fontWeight: '800', textAlign: 'center',
    lineHeight: 26, overflow: 'hidden',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.2 },

  // ── Input styles ──────────────────────────
  label:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, letterSpacing: 0.2 },
  labelError: { color: COLORS.error },
  required:   { color: COLORS.error },
  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError: { borderColor: COLORS.error },
  errorText:  { marginTop: 5, fontSize: 12, color: COLORS.error, fontWeight: '500' },

  // ── Product qty block ─────────────────────
  productQtyBlock:       { paddingVertical: 14 },
  productQtyBlockBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },

  productNameRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10,
  },
  productIndexBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  productIndexText: { fontSize: 11, fontWeight: '800', color: COLORS.surface },
  productName: {
    flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
  },

  // ── Remove button ─────────────────────────
  removeBtn: {
    paddingHorizontal: 9, paddingVertical: 5,
    backgroundColor: '#FFEBEE', borderRadius: 7,
    flexShrink: 0,
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  qtyInput: { marginTop: 2 },

  // ── Sale summary footer ───────────────────
  saleSummaryFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1.5, borderTopColor: COLORS.primary + '30',
  },
  saleSummaryLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.2 },
  saleSummaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  // ── Submit button ─────────────────────────
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, gap: 10,
    marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  submitIcon: { fontSize: 18 },
  submitText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  // ── Modal summary table ───────────────────
  modalSummary:       { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalSummaryHeader: { backgroundColor: '#E8EEF8' },
  modalHeaderText: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  modalSummaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12,
  },
  modalSummaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalSummaryCol:      { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalSummaryColRight: { flex: 1, fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'right' },
  modalQty:             { color: COLORS.error, fontWeight: '700' },
  modalAfterOk:         { color: COLORS.success, fontWeight: '700' },
  modalAfterEmpty:      { color: COLORS.error, fontWeight: '700' },
  modalTotalRow:        { borderTopWidth: 1.5, borderTopColor: '#D0D0D0', backgroundColor: '#ECEEF5' },
  modalTotalLabel:      { flex: 2, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  modalTotalValue:      { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.primary, textAlign: 'right' },
});