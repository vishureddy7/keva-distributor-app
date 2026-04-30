// ─────────────────────────────────────────────
//  AddProductScreen.js  (UPDATED)
//  Add MULTIPLE products in one go.
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
import { addProduct }     from '../services/productService';
import ConfirmModal       from '../components/ConfirmModal';
import { COLORS }         from '../utils/constants';
import {
  validateProductName,
  validateOpeningStock,
} from '../utils/validators';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

let _id = 1;
const newRow = () => ({
  id:        String(_id++),
  name:      '',
  qty:       '',
  nameError: '',
  qtyError:  '',
});

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function AddProductScreen() {
  const { productNames, refreshProducts } = useAppContext();

  const [rows,         setRows]         = useState([newRow()]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [lastAdded,    setLastAdded]    = useState(null);
  const [globalError,  setGlobalError]  = useState('');

  // ── Row helpers ───────────────────────────
  function addRow() {
    setRows(prev => [...prev, newRow()]);
    setLastAdded(null);
  }

  function removeRow(id) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value, [`${field}Error`]: '' } : r
    ));
    setLastAdded(null);
    setGlobalError('');
  }

  function setRowError(id, field, msg) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [`${field}Error`]: msg } : r));
  }

  // ── Validation ────────────────────────────
  function validateAll() {
    let valid = true;

    // Build combined existing names (DB + names being typed in other rows)
    const allCurrentNames = [...productNames];

    rows.forEach((row, idx) => {
      // Check against DB names + earlier rows in the same batch
      const namesBeforeThis = [
        ...allCurrentNames,
        ...rows.slice(0, idx).map(r => r.name.trim()).filter(Boolean),
      ];

      const nameCheck = validateProductName(row.name, namesBeforeThis);
      const qtyCheck  = validateOpeningStock(row.qty);

      if (!nameCheck.valid) { setRowError(row.id, 'name', nameCheck.error); valid = false; }
      if (!qtyCheck.valid)  { setRowError(row.id, 'qty',  qtyCheck.error);  valid = false; }
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
    const added  = [];
    const errors = [];

    // Rebuild combined names dynamically as we add
    let runningNames = [...productNames];

    for (const row of rows) {
      try {
        await addProduct(row.name.trim(), row.qty, runningNames);
        runningNames.push(row.name.trim());
        added.push({ name: row.name.trim(), qty: Number(row.qty) });
      } catch (err) {
        errors.push(`"${row.name.trim()}": ${err.message}`);
      }
    }

    await refreshProducts();

    if (added.length > 0) setLastAdded(added);
    if (errors.length > 0) setGlobalError(errors.join('\n'));

    if (added.length > 0) {
      setRows([newRow()]);
    }

    setSaving(false);
    setModalVisible(false);
  }

  // ── Derived ───────────────────────────────
  const validRows  = rows.filter(r => r.name.trim().length >= 2);
  const canSubmit  = validRows.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Success banner ──────────────── */}
        {lastAdded && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✅</Text>
            <View style={styles.successTextGroup}>
              <Text style={styles.successTitle}>
                {lastAdded.length} Product{lastAdded.length !== 1 ? 's' : ''} Added!
              </Text>
              {lastAdded.map(p => (
                <Text key={p.name} style={styles.successMsg}>
                  <Text style={styles.bold}>"{p.name}"</Text> — {p.qty} unit{p.qty !== 1 ? 's' : ''} opening stock
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

        {/* ── Info strip ───────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Add multiple products at once. Each gets its own sheet in the Excel export.
            Names must be unique and cannot be deleted later.
          </Text>
        </View>

        {/* ── Product rows ─────────────────── */}
        {rows.map((row, index) => (
          <ProductRow
            key={row.id}
            row={row}
            index={index}
            totalRows={rows.length}
            onNameChange={(v) => updateRow(row.id, 'name', v)}
            onQtyChange={(v)  => updateRow(row.id, 'qty',  v)}
            onRemove={() => removeRow(row.id)}
          />
        ))}

        {/* ── Add another row ──────────────── */}
        <TouchableOpacity style={styles.addRowBtn} onPress={addRow} activeOpacity={0.8}>
          <Text style={styles.addRowIcon}>➕</Text>
          <Text style={styles.addRowText}>Add Another Product</Text>
        </TouchableOpacity>

        {/* ── Submit ───────────────────────── */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          <Text style={styles.submitIcon}>➕</Text>
          <Text style={styles.submitText}>
            Add {canSubmit ? validRows.length : ''} Product{validRows.length !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm modal ───────────────────── */}
      <ConfirmModal
        visible={modalVisible}
        title={`Add ${validRows.length} Product${validRows.length !== 1 ? 's' : ''}?`}
        message="Each product will be created with its own transaction history. This cannot be undone."
        confirmLabel="Add Products"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => !saving && setModalVisible(false)}
        loading={saving}
      >
        <View style={styles.modalSummary}>
          <View style={[styles.modalRow, styles.modalHeader]}>
            <Text style={[styles.modalCol, styles.modalHeaderText]}>Product Name</Text>
            <Text style={[styles.modalColRight, styles.modalHeaderText]}>Opening Qty</Text>
          </View>
          {rows.filter(r => r.name.trim()).map((row, i) => (
            <View key={row.id} style={[styles.modalRow, i < rows.length - 1 && styles.modalRowBorder]}>
              <Text style={styles.modalCol} numberOfLines={2}>{row.name.trim()}</Text>
              <Text style={[styles.modalColRight, styles.modalQty]}>
                {row.qty || '0'} unit{Number(row.qty) !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </View>
      </ConfirmModal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  ProductRow — one product being added
// ─────────────────────────────────────────────

function ProductRow({ row, index, totalRows, onNameChange, onQtyChange, onRemove }) {
  const qtyRef = useRef(null);

  function handleQtyChange(text) {
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    onQtyChange(cleaned);
  }

  return (
    <View style={styles.card}>
      {/* Row header */}
      <View style={styles.rowHeader}>
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.rowLabel}>Product {index + 1}</Text>
        {totalRows > 1 && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeBtnText}>✕ Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Product Name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, !!row.nameError && styles.fieldLabelError]}>
          Product Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, !!row.nameError && styles.inputError]}
          value={row.name}
          onChangeText={onNameChange}
          placeholder="e.g. Keva Block Set A"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={60}
          returnKeyType="next"
          onSubmitEditing={() => qtyRef.current?.focus()}
          blurOnSubmit={false}
        />
        {!!row.nameError
          ? <Text style={styles.errorText}>{row.nameError}</Text>
          : <Text style={styles.hint}>Min 2 chars · Must be unique</Text>
        }
      </View>

      {/* Opening Qty */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, !!row.qtyError && styles.fieldLabelError]}>
          Opening Stock <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          ref={qtyRef}
          style={[styles.input, !!row.qtyError && styles.inputError]}
          value={row.qty}
          onChangeText={handleQtyChange}
          placeholder="0"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={8}
        />
        {!!row.qtyError
          ? <Text style={styles.errorText}>{row.qtyError}</Text>
          : <Text style={styles.hint}>Can be 0 for pre-orders</Text>
        }
      </View>

      {/* Live preview pill */}
      {row.name.trim().length > 0 && (
        <View style={styles.previewPill}>
          <Text style={styles.previewName} numberOfLines={1}>{row.name.trim()}</Text>
          <View style={styles.previewDot} />
          <Text style={styles.previewQty}>
            {row.qty || '0'} unit{Number(row.qty) !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
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
  successTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.success, marginBottom: 4 },
  successMsg:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 20 },
  bold:             { fontWeight: '700' },

  errorBanner: {
    backgroundColor: '#FFEBEE', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.error,
    padding: 12, marginBottom: 12,
  },
  errorBannerText: { fontSize: 13, color: COLORS.error, lineHeight: 20 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: 10,
    padding: 12, marginBottom: 14, gap: 10,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 18 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },

  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  rowBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  rowBadgeText:  { fontSize: 12, fontWeight: '800', color: COLORS.surface },
  rowLabel:      { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  removeBtn:     { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFEBEE', borderRadius: 6 },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldLabelError: { color: COLORS.error },
  required:    { color: COLORS.error },

  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError: { borderColor: COLORS.error },
  errorText:  { marginTop: 4, fontSize: 12, color: COLORS.error, fontWeight: '500' },
  hint:       { marginTop: 4, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },

  previewPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, gap: 6, marginTop: 4,
  },
  previewName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  previewDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.primaryLight },
  previewQty:  { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.accent, borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, marginBottom: 12, gap: 8,
  },
  addRowIcon: { fontSize: 18, color: COLORS.accent },
  addRowText: { fontSize: 15, fontWeight: '700', color: COLORS.accent },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 15, gap: 10,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  submitIcon: { fontSize: 18 },
  submitText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  modalSummary:    { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalHeader:     { backgroundColor: '#E8EEF8' },
  modalHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  modalRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  modalRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalCol:        { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalColRight:   { flex: 1, fontSize: 13, textAlign: 'right', color: COLORS.textPrimary },
  modalQty:        { color: COLORS.primary, fontWeight: '700' },
});