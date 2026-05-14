// ─────────────────────────────────────────────
//  BilledUnsoldScreen.js
//
//  Track products that are billed to customers
//  but not yet physically sold / delivered.
//  Does NOT touch stock levels — purely informational.
//
//  Features:
//    • Product picker + quantity + optional notes
//    • Confirm modal before saving
//    • Running summary table (product → total units)
//    • Scrollable list of every entry with delete
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
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppContext } from '../context/AppContext';
import {
  addBilledUnsold,
  getBilledUnsoldList,
  deleteBilledUnsoldEntry,
} from '../services/firebaseService';
import ProductDropdown from '../components/ProductDropdown';
import ConfirmModal    from '../components/ConfirmModal';
import { COLORS }      from '../utils/constants';

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function BilledUnsoldScreen() {
  const { productNames } = useAppContext();

  // ── Form state ────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity,        setQuantity]        = useState('');
  const [notes,           setNotes]           = useState('');
  const [productError,    setProductError]    = useState('');
  const [qtyError,        setQtyError]        = useState('');

  // ── Modal state ───────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [lastAdded,    setLastAdded]    = useState(null);

  // ── List state ────────────────────────────
  const [entries,     setEntries]     = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [deletingId,  setDeletingId]  = useState(null);

  // ── Load entries ──────────────────────────
  const loadEntries = useCallback(async () => {
    try {
      setListLoading(true);
      const list = await getBilledUnsoldList();
      setEntries(list);
    } catch (err) {
      console.error('BilledUnsoldScreen load error:', err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadEntries(); }, [loadEntries]));

  // ─────────────────────────────────────────
  //  Handlers
  // ─────────────────────────────────────────

  function handleProductChange(val) {
    setSelectedProduct(val);
    setProductError('');
    setLastAdded(null);
  }

  function handleQtyChange(text) {
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setQuantity(cleaned);
    setQtyError('');
    setLastAdded(null);
  }

  // ── Validate ──────────────────────────────
  function validate() {
    let ok = true;

    if (!selectedProduct) {
      setProductError('Please select a product.');
      ok = false;
    } else {
      setProductError('');
    }

    const num = parseFloat(quantity);
    if (!quantity || isNaN(num) || num <= 0) {
      setQtyError('Enter a quantity greater than 0.');
      ok = false;
    } else {
      setQtyError('');
    }

    return ok;
  }

  function handlePreview() {
    Keyboard.dismiss();
    if (!validate()) return;
    setModalVisible(true);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await addBilledUnsold(selectedProduct, parseFloat(quantity), notes.trim());
      await loadEntries();

      setLastAdded({ product: selectedProduct, qty: parseFloat(quantity) });

      // Reset form
      setSelectedProduct(null);
      setQuantity('');
      setNotes('');
      setProductError('');
      setQtyError('');
      setModalVisible(false);
    } catch (err) {
      setModalVisible(false);
      Alert.alert('Error', err.message || 'Could not save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────
  async function handleDelete(id) {
    Alert.alert(
      'Delete Entry',
      'Remove this billed-unsold record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteBilledUnsoldEntry(id);
              await loadEntries();
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not delete entry.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }

  // ── Derived: product totals for summary ───
  const productTotals = {};
  entries.forEach((e) => {
    if (!productTotals[e.productName]) productTotals[e.productName] = 0;
    productTotals[e.productName] += (e.quantity || 0);
  });
  const grandTotal = entries.reduce((s, e) => s + (e.quantity || 0), 0);

  const canSubmit = !!selectedProduct && !!quantity;

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
        {lastAdded && (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✅</Text>
            <View style={styles.successTextGroup}>
              <Text style={styles.successTitle}>Entry Added!</Text>
              <Text style={styles.successMsg}>
                <Text style={styles.bold}>{lastAdded.qty} unit{lastAdded.qty !== 1 ? 's' : ''}</Text>
                {' '}of <Text style={styles.bold}>"{lastAdded.product}"</Text> recorded as billed but unsold.
              </Text>
            </View>
          </View>
        )}

        {/* ── Info strip ───────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📋</Text>
          <Text style={styles.infoText}>
            Track products that are billed to customers but haven't been
            physically delivered or sold yet.{' '}
            <Text style={styles.infoBold}>Stock levels are not affected.</Text>
          </Text>
        </View>

        {/* ── Form card ────────────────────── */}
        <View style={[styles.formCard, { zIndex: 2000, elevation: 2000 }]}>
          <Text style={styles.formTitle}>➕  New Billed (Unsold) Entry</Text>

          {/* Product */}
          <ProductDropdown
            mode="single"
            items={productNames}
            value={selectedProduct}
            onValueChange={handleProductChange}
            label="Product"
            placeholder="Select a product…"
            error={productError}
            zIndex={2000}
            zIndexInverse={1000}
          />

          <View style={{ height: 14 }} />

          {/* Quantity */}
          <Text style={[styles.label, !!qtyError && styles.labelError]}>
            Quantity <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, !!qtyError && styles.inputError]}
            value={quantity}
            onChangeText={handleQtyChange}
            placeholder="e.g. 10"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={8}
          />
          {!!qtyError && <Text style={styles.errorText}>{qtyError}</Text>}

          <View style={{ height: 14 }} />

          {/* Notes */}
          <Text style={styles.label}>
            Notes <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Invoice #123, customer reference…"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="sentences"
            multiline
            numberOfLines={2}
            maxLength={120}
          />
        </View>

        {/* ── Add button ───────────────────── */}
        <TouchableOpacity
          style={[styles.addBtn, !canSubmit && styles.addBtnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          <Text style={styles.addBtnIcon}>📋</Text>
          <Text style={styles.addBtnText}>Add Entry</Text>
        </TouchableOpacity>

        {/* ══════════════════════════════════
            SUMMARY — product totals
        ═══════════════════════════════════ */}
        {!listLoading && Object.keys(productTotals).length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Billed Unsold Summary</Text>

            {Object.entries(productTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([name, total], i, arr) => (
                <View
                  key={name}
                  style={[
                    styles.summaryRow,
                    i < arr.length - 1 && styles.summaryRowBorder,
                  ]}
                >
                  <Text style={styles.summaryProduct} numberOfLines={2}>
                    {name}
                  </Text>
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>{total} units</Text>
                  </View>
                </View>
              ))
            }

            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Grand Total</Text>
              <Text style={styles.summaryTotalValue}>{grandTotal} units</Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════
            ENTRIES LIST
        ═══════════════════════════════════ */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>All Entries</Text>
            {!listLoading && entries.length > 0 && (
              <Text style={styles.listHeaderCount}>
                {entries.length} record{entries.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {listLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading entries…</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyHint}>
                Add your first billed-unsold entry above.
              </Text>
            </View>
          ) : (
            entries.map((entry, index) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isEven={index % 2 === 0}
                isDeleting={deletingId === entry.id}
                onDelete={() => handleDelete(entry.id)}
              />
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm modal ─────────────────── */}
      <ConfirmModal
        visible={modalVisible}
        title="Add Billed Entry?"
        message={
          `Recording ${quantity} unit${parseFloat(quantity) !== 1 ? 's' : ''} of "${selectedProduct}" ` +
          `as billed but unsold.\n\n` +
          `⚠ Stock levels will NOT be changed.`
        }
        confirmLabel="Add Entry"
        cancelLabel="Cancel"
        confirmColor={COLORS.accent}
        onConfirm={handleConfirm}
        onCancel={() => !saving && setModalVisible(false)}
        loading={saving}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  EntryCard
// ─────────────────────────────────────────────

function EntryCard({ entry, isEven, isDeleting, onDelete }) {
  return (
    <View style={[eStyles.card, isEven && eStyles.cardEven]}>

      {/* Avatar */}
      <View style={eStyles.avatar}>
        <Text style={eStyles.avatarText}>
          {(entry.productName || '?')[0].toUpperCase()}
        </Text>
      </View>

      {/* Middle */}
      <View style={eStyles.mid}>
        <Text style={eStyles.productName} numberOfLines={2}>
          {entry.productName}
        </Text>
        <Text style={eStyles.timestamp}>{entry.timestamp}</Text>
        {!!entry.notes && (
          <Text style={eStyles.notes} numberOfLines={2}>{entry.notes}</Text>
        )}
      </View>

      {/* Right */}
      <View style={eStyles.right}>
        <Text style={eStyles.qty}>{entry.quantity}</Text>
        <Text style={eStyles.qtyLabel}>units</Text>
        <TouchableOpacity
          style={[eStyles.deleteBtn, isDeleting && eStyles.deleteBtnDisabled]}
          onPress={onDelete}
          disabled={isDeleting}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          {isDeleting
            ? <ActivityIndicator size="small" color={COLORS.error} />
            : <Text style={eStyles.deleteBtnText}>🗑</Text>
          }
        </TouchableOpacity>
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

  // ── Info strip ────────────────────────────
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF8E1', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.accent,
    padding: 12, marginBottom: 14, gap: 10,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: '#795548', lineHeight: 18 },
  infoBold: { fontWeight: '700' },

  // ── Form card ─────────────────────────────
  formCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  formTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14,
  },

  label:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, letterSpacing: 0.2 },
  labelError: { color: COLORS.error },
  required:   { color: COLORS.error },
  optional:   { fontSize: 12, fontWeight: '400', color: COLORS.textSecondary },

  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError: { borderColor: COLORS.error },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  errorText:  { marginTop: 5, fontSize: 12, color: COLORS.error, fontWeight: '500' },

  // ── Add button ────────────────────────────
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 15, gap: 10,
    marginBottom: 22,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  addBtnDisabled: { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  addBtnIcon: { fontSize: 18 },
  addBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  // ── Summary card ──────────────────────────
  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  summaryTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10,
  },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  summaryProduct: {
    flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, lineHeight: 18,
  },
  summaryBadge: {
    backgroundColor: '#FFF3E0', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  summaryBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  summaryTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1.5, borderTopColor: COLORS.accent + '40',
  },
  summaryTotalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  summaryTotalValue: { fontSize: 20, fontWeight: '800', color: COLORS.accent },

  // ── Entries list ──────────────────────────
  listSection: { marginBottom: 8 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  listHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  listHeaderCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  loadingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 28, gap: 10,
  },
  loadingText: { fontSize: 13, color: COLORS.textSecondary },

  emptyBox: {
    paddingVertical: 44, alignItems: 'center', paddingHorizontal: 24,
  },
  emptyIcon:  { fontSize: 42, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const eStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    marginBottom: 9, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: COLORS.accent,
  },
  cardEven: { backgroundColor: '#FAFBFF' },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: COLORS.accent },

  mid:         { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2, lineHeight: 19 },
  timestamp:   { fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 },
  notes:       { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 16 },

  right: { alignItems: 'center', minWidth: 54, gap: 4 },
  qty:   { fontSize: 22, fontWeight: '800', color: COLORS.accent, lineHeight: 26 },
  qtyLabel: {
    fontSize: 10, color: COLORS.textSecondary, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 0.2,
  },

  deleteBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontSize: 14 },
});