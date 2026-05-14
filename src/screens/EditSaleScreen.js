// ─────────────────────────────────────────────
//  EditSaleScreen.js  (UPDATED)
//
//  Now edits the FULL sale group, not just one line.
//  Editable fields:
//    • Customer name
//    • Date / Time (timestamp string)
//    • Billing status (billed / unbilled) — NEW
//    • Products — edit quantity, remove, or add new
//  Also: Delete entire sale (restores all stock).
//
//  FIX: billing status is now preserved correctly
//  when saving (was always resetting to 'billed').
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
  Alert,
} from 'react-native';

import { useAppContext }             from '../context/AppContext';
import { updateSaleGroup }           from '../services/firebaseService';
import { deleteSaleGroup }           from '../services/firebaseService';
import ProductDropdown               from '../components/ProductDropdown';
import ConfirmModal                  from '../components/ConfirmModal';
import { COLORS, BILLING_STATUS }    from '../utils/constants';
import { getNowTimestamp }           from '../utils/dateHelpers';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

let _id = 1;
const makeEditItem = (productName, quantity) => ({
  _key:        String(_id++),
  productName,
  quantity:    String(quantity),
  qtyError:    '',
  prodError:   '',
});

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function EditSaleScreen({ route, navigation }) {
  const { group } = route.params;
  const { productNames, getStockFor, refreshProducts } = useAppContext();

  // ── Editable state ───────────────────────
  const [customer,       setCustomer]       = useState(group.customerOrSource || '');
  const [timestamp,      setTimestamp]      = useState(group.timestamp || getNowTimestamp());
  const [billingStatus,  setBillingStatus]  = useState(
    group.billingStatus || BILLING_STATUS.UNBILLED,
  );
  const [editItems,      setEditItems]      = useState(
    group.items.map((tx) => makeEditItem(tx.productName, tx.quantity)),
  );

  // Errors
  const [customerError, setCustomerError] = useState('');
  const [tsError,       setTsError]       = useState('');
  const [globalError,   setGlobalError]   = useState('');

  // Modals
  const [saveVisible,   setSaveVisible]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── Derived: which products are already picked ──
  const pickedNames = editItems.map((i) => i.productName).filter(Boolean);

  // ── Stock available for each product ──────
  // For items that were in the original sale, add back the original qty
  // so we don't block editing the same item.
  const originalQtyMap = {};
  group.items.forEach((tx) => {
    originalQtyMap[tx.productName] = (originalQtyMap[tx.productName] || 0) + tx.quantity;
  });

  function maxQtyFor(productName) {
    const current  = getStockFor(productName);
    const original = originalQtyMap[productName] || 0;
    return current + original;
  }

  // ─────────────────────────────────────────
  //  Item helpers
  // ─────────────────────────────────────────

  function addItem() {
    setEditItems((prev) => [...prev, makeEditItem(null, '')]);
    setGlobalError('');
  }

  function removeItem(key) {
    setEditItems((prev) => prev.filter((i) => i._key !== key));
    setGlobalError('');
  }

  function updateProduct(key, productName) {
    setEditItems((prev) =>
      prev.map((i) =>
        i._key === key
          ? { ...i, productName, prodError: '', qtyError: '' }
          : i,
      ),
    );
    setGlobalError('');
  }

  function updateQty(key, text) {
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setEditItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, quantity: cleaned, qtyError: '' } : i)),
    );
    setGlobalError('');
  }

  function setItemError(key, field, msg) {
    setEditItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: msg } : i)),
    );
  }

  // ─────────────────────────────────────────
  //  Validation
  // ─────────────────────────────────────────

  function validate() {
    let ok = true;
    setCustomerError('');
    setTsError('');
    setGlobalError('');

    if (!customer.trim() || customer.trim().length < 2) {
      setCustomerError('Customer name must be at least 2 characters.');
      ok = false;
    }

    if (!timestamp.trim()) {
      setTsError('Date / time is required.');
      ok = false;
    }

    if (editItems.length === 0) {
      setGlobalError('Add at least one product.');
      ok = false;
    }

    // Duplicate product check
    const names = editItems.map((i) => i.productName).filter(Boolean);
    const hasDupe = names.length !== new Set(names).size;
    if (hasDupe) {
      setGlobalError('Each product can only appear once. Remove duplicates.');
      ok = false;
    }

    editItems.forEach((item) => {
      if (!item.productName) {
        setItemError(item._key, 'prodError', 'Select a product.');
        ok = false;
      }
      const num = parseFloat(item.quantity);
      if (!item.quantity || isNaN(num) || num <= 0) {
        setItemError(item._key, 'qtyError', 'Enter a quantity greater than 0.');
        ok = false;
      } else if (item.productName) {
        const max = maxQtyFor(item.productName);
        if (num > max) {
          setItemError(
            item._key,
            'qtyError',
            `Only ${max} unit${max !== 1 ? 's' : ''} available.`,
          );
          ok = false;
        }
      }
    });

    return ok;
  }

  // ─────────────────────────────────────────
  //  Save
  // ─────────────────────────────────────────

  function handlePreviewSave() {
    Keyboard.dismiss();
    if (!validate()) return;
    setSaveVisible(true);
  }

  async function handleConfirmSave() {
    setSaving(true);
    try {
      const newItems = editItems.map((i) => ({
        productName: i.productName,
        quantity:    parseFloat(i.quantity),
      }));

      await updateSaleGroup(
        group.items.map((tx) => ({ id: tx.id, productName: tx.productName, quantity: tx.quantity })),
        newItems,
        customer.trim(),
        timestamp.trim(),
        group.createdAt,
        billingStatus,           // ← correctly passed now (was missing before)
      );

      await refreshProducts();
      setSaveVisible(false);
      navigation.goBack();
    } catch (err) {
      setSaveVisible(false);
      setGlobalError(err.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────
  //  Delete entire sale
  // ─────────────────────────────────────────

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteSaleGroup(
        group.items.map((tx) => ({ id: tx.id, productName: tx.productName, quantity: tx.quantity })),
      );
      await refreshProducts();
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      setDeleteVisible(false);
      Alert.alert('Delete Failed', err.message || 'Could not delete the sale record.');
    } finally {
      setDeleting(false);
    }
  }

  // ─────────────────────────────────────────
  //  Derived
  // ─────────────────────────────────────────

  const validItems  = editItems.filter((i) => i.productName && parseFloat(i.quantity) > 0);
  const totalUnits  = validItems.reduce((s, i) => s + parseFloat(i.quantity), 0);
  const hasChanged  =
    customer.trim() !== group.customerOrSource ||
    timestamp.trim() !== group.timestamp ||
    billingStatus !== (group.billingStatus || BILLING_STATUS.UNBILLED) ||
    JSON.stringify(validItems.map((i) => ({ p: i.productName, q: parseFloat(i.quantity) }))) !==
    JSON.stringify(group.items.map((tx) => ({ p: tx.productName, q: tx.quantity })));

  // Products available to add (not already picked)
  const availableToAdd = productNames.filter((n) => !pickedNames.includes(n));

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

        {/* ── Global error ─────────────────── */}
        {!!globalError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{globalError}</Text>
          </View>
        )}

        {/* ── Original sale summary ─────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Original Sale</Text>
          <InfoRow label="Customer"  value={group.customerOrSource} />
          <InfoRow label="Date/Time" value={group.timestamp} />
          <InfoRow
            label="Billing"
            value={
              (group.billingStatus || BILLING_STATUS.UNBILLED) === BILLING_STATUS.BILLED
                ? '🧾 Billed'
                : '📋 Unbilled'
            }
          />
          <InfoRow
            label="Products"
            value={`${group.items.length} item${group.items.length !== 1 ? 's' : ''}, ${group.items.reduce((s, t) => s + t.quantity, 0)} units total`}
            isLast
          />
        </View>

        {/* ── Edit form ────────────────────── */}
        <View style={[styles.formCard, { zIndex: 3000 }]}>
          <Text style={styles.formTitle}>✏️  Edit Sale</Text>

          {/* Customer name */}
          <Text style={[styles.label, !!customerError && styles.labelError]}>
            Customer Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, !!customerError && styles.inputError]}
            value={customer}
            onChangeText={(t) => { setCustomer(t); setCustomerError(''); }}
            placeholder="Customer name"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={80}
            returnKeyType="next"
          />
          {!!customerError && <Text style={styles.errorText}>{customerError}</Text>}

          <View style={{ height: 14 }} />

          {/* Date / Time */}
          <Text style={[styles.label, !!tsError && styles.labelError]}>
            Date / Time <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, !!tsError && styles.inputError]}
            value={timestamp}
            onChangeText={(t) => { setTimestamp(t); setTsError(''); }}
            placeholder="e.g. 06-May-2026 3:45 PM"
            placeholderTextColor={COLORS.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={30}
            returnKeyType="next"
          />
          {!!tsError
            ? <Text style={styles.errorText}>{tsError}</Text>
            : <Text style={styles.hint}>Format: DD-MMM-YYYY H:MM AM/PM</Text>
          }

          <View style={{ height: 16 }} />

          {/* ── Billing status toggle ── */}
          <Text style={styles.label}>Billing Status</Text>
          <Text style={styles.billingHint}>
            Change whether this sale is billed or unbilled.
          </Text>
          <View style={styles.billingToggleRow}>
            <TouchableOpacity
              style={[
                styles.billingPill,
                billingStatus === BILLING_STATUS.UNBILLED && styles.billingPillActiveUnbilled,
              ]}
              onPress={() => setBillingStatus(BILLING_STATUS.UNBILLED)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.billingPillText,
                billingStatus === BILLING_STATUS.UNBILLED && styles.billingPillTextActive,
              ]}>
                📋  Unbilled
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingPill,
                billingStatus === BILLING_STATUS.BILLED && styles.billingPillActiveBilled,
              ]}
              onPress={() => setBillingStatus(BILLING_STATUS.BILLED)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.billingPillText,
                billingStatus === BILLING_STATUS.BILLED && styles.billingPillTextActive,
              ]}>
                🧾  Billed
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Product list ─────────────────── */}
        <View style={styles.productsCard}>
          <Text style={styles.formTitle}>📦  Products in This Sale</Text>

          {editItems.map((item, index) => (
            <ProductItemRow
              key={item._key}
              item={item}
              index={index}
              total={editItems.length}
              productNames={productNames}
              pickedNames={pickedNames.filter((n) => n !== item.productName)}
              maxQty={item.productName ? maxQtyFor(item.productName) : 0}
              zIndex={2000 - index * 50}
              onProductChange={(val) => updateProduct(item._key, val)}
              onQtyChange={(val)     => updateQty(item._key, val)}
              onRemove={() => removeItem(item._key)}
            />
          ))}

          {/* Add product button */}
          <TouchableOpacity
            style={[styles.addBtn, availableToAdd.length === 0 && styles.addBtnDisabled]}
            onPress={addItem}
            disabled={availableToAdd.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnIcon}>＋</Text>
            <Text style={styles.addBtnText}>
              {availableToAdd.length === 0 ? 'All products already added' : 'Add Another Product'}
            </Text>
          </TouchableOpacity>

          {/* Total */}
          {totalUnits > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Units</Text>
              <Text style={styles.totalValue}>{totalUnits}</Text>
            </View>
          )}
        </View>

        {/* ── Save button ──────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, !hasChanged && styles.btnDisabled]}
          onPress={handlePreviewSave}
          activeOpacity={0.85}
          disabled={!hasChanged}
        >
          <Text style={styles.saveBtnIcon}>💾</Text>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>

        {/* ── Danger zone ──────────────────── */}
        <View style={styles.divider} />
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠ Danger Zone</Text>
          <Text style={styles.dangerDesc}>
            Deletes this entire sale and restores stock for all{' '}
            {group.items.length} product{group.items.length !== 1 ? 's' : ''}. Cannot be undone.
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setDeleteVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.deleteBtnIcon}>🗑️</Text>
            <Text style={styles.deleteBtnText}>Delete Entire Sale</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Save confirm modal ─────────────── */}
      <ConfirmModal
        visible={saveVisible}
        title="Save Changes?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        confirmColor={COLORS.primary}
        onConfirm={handleConfirmSave}
        onCancel={() => !saving && setSaveVisible(false)}
        loading={saving}
      >
        <View style={styles.modalSummary}>
          <ModalRow label="Customer"   value={customer.trim()} isFirst />
          <ModalRow label="Date/Time"  value={timestamp.trim()} />
          <ModalRow
            label="Billing"
            value={billingStatus === BILLING_STATUS.BILLED ? '🧾 Billed' : '📋 Unbilled'}
          />
          <ModalRow
            label="Products"
            value={`${validItems.length} item${validItems.length !== 1 ? 's' : ''}, ${totalUnits} units`}
            isLast
            highlight
          />
        </View>
        {/* Item breakdown */}
        <View style={[styles.modalSummary, { marginTop: 8 }]}>
          <View style={[styles.modalRow, styles.modalHeader]}>
            <Text style={[styles.modalCol, styles.modalHeaderText]}>Product</Text>
            <Text style={[styles.modalColRight, styles.modalHeaderText]}>Qty</Text>
          </View>
          {validItems.map((item, i) => (
            <View key={item._key} style={[styles.modalRow, i < validItems.length - 1 && styles.modalRowBorder]}>
              <Text style={styles.modalCol} numberOfLines={2}>{item.productName}</Text>
              <Text style={[styles.modalColRight, styles.modalQty]}>{item.quantity}</Text>
            </View>
          ))}
        </View>
      </ConfirmModal>

      {/* ── Delete confirm modal ─────────────── */}
      <ConfirmModal
        visible={deleteVisible}
        title="Delete Entire Sale?"
        message={
          `This will permanently delete the sale for "${group.customerOrSource}" ` +
          `and restore stock for all ${group.items.length} product${group.items.length !== 1 ? 's' : ''}.\n\n` +
          `This cannot be undone.`
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        confirmColor={COLORS.error}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteVisible(false)}
        loading={deleting}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  ProductItemRow — one editable product entry
// ─────────────────────────────────────────────

function ProductItemRow({
  item, index, total, productNames, pickedNames,
  maxQty, zIndex,
  onProductChange, onQtyChange, onRemove,
}) {
  // Available items = all products minus already-picked ones (except self)
  const availableItems = productNames.filter((n) => !pickedNames.includes(n));

  return (
    <View style={[styles.itemRow, { zIndex, elevation: zIndex }]}>
      {/* Row header */}
      <View style={styles.itemRowHeader}>
        <View style={styles.itemBadge}>
          <Text style={styles.itemBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.itemRowTitle}>Product {index + 1}</Text>
        {total > 1 && (
          <TouchableOpacity
            style={styles.removeItemBtn}
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeItemText}>✕ Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Product picker */}
      <ProductDropdown
        mode="single"
        items={availableItems}
        value={item.productName}
        onValueChange={onProductChange}
        label="Product"
        placeholder="Select a product…"
        error={item.prodError}
        zIndex={zIndex}
        zIndexInverse={500}
      />

      {/* Stock hint */}
      {item.productName && (
        <View style={styles.stockHint}>
          <Text style={styles.stockHintText}>
            Max available: {maxQty} unit{maxQty !== 1 ? 's' : ''} (including original sale qty)
          </Text>
        </View>
      )}

      {/* Quantity */}
      <View style={{ marginTop: 8 }}>
        <Text style={[styles.label, !!item.qtyError && styles.labelError]}>
          Quantity <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            !!item.qtyError   && styles.inputError,
            !item.productName && styles.inputDisabled,
          ]}
          value={item.quantity}
          onChangeText={onQtyChange}
          placeholder={item.productName ? 'Enter quantity' : 'Select product first'}
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
//  InfoRow / ModalRow
// ─────────────────────────────────────────────

function InfoRow({ label, value, isLast }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ModalRow({ label, value, isFirst, isLast, highlight }) {
  return (
    <View style={[styles.modalRow, !isFirst && styles.modalRowBorder]}>
      <Text style={styles.modalLabel}>{label}</Text>
      <Text style={[styles.modalValue, highlight && styles.modalValueHighlight]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },

  errorBanner: {
    backgroundColor: '#FFEBEE', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.error,
    padding: 12, marginBottom: 12,
  },
  errorBannerText: { fontSize: 13, color: COLORS.error, lineHeight: 20 },

  // ── Info card ─────────────────────────────
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  infoTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, alignItems: 'center',
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel:     { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue:     { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  // ── Form card ─────────────────────────────
  formCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },

  // ── Billing toggle ────────────────────────
  billingHint: {
    fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 17,
  },
  billingToggleRow: { flexDirection: 'row', gap: 10 },
  billingPill: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#BDBDBD',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  billingPillActiveUnbilled: { backgroundColor: '#FFF3E0', borderColor: COLORS.warning },
  billingPillActiveBilled:   { backgroundColor: '#E8F5E9', borderColor: COLORS.success },
  billingPillText:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  billingPillTextActive: { color: COLORS.textPrimary, fontWeight: '800' },

  // ── Products card ─────────────────────────
  productsCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },

  // ── Product item row ──────────────────────
  itemRow: {
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    paddingBottom: 16, marginBottom: 16,
  },
  itemRowHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8,
  },
  itemBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  itemBadgeText:  { fontSize: 12, fontWeight: '800', color: COLORS.surface },
  itemRowTitle:   { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  removeItemBtn:  { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFEBEE', borderRadius: 6 },
  removeItemText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  stockHint: {
    backgroundColor: '#E8F5E9', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 6,
  },
  stockHintText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },

  // ── Add button ────────────────────────────
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, marginTop: 4, gap: 8,
  },
  addBtnDisabled: { borderColor: '#BDBDBD' },
  addBtnIcon: { fontSize: 16, color: COLORS.primary },
  addBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  // ── Total row ─────────────────────────────
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1.5, borderTopColor: COLORS.primary + '30',
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  // ── Input styles ──────────────────────────
  label:         { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  labelError:    { color: COLORS.error },
  required:      { color: COLORS.error },
  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError:    { borderColor: COLORS.error },
  inputDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', color: COLORS.textSecondary },
  errorText:     { marginTop: 5, fontSize: 12, color: COLORS.error, fontWeight: '500' },
  hint:          { marginTop: 5, fontSize: 11, color: COLORS.textSecondary },

  // ── Buttons ───────────────────────────────
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, gap: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  btnDisabled:  { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  saveBtnIcon:  { fontSize: 18 },
  saveBtnText:  { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  divider: {
    height: 1, backgroundColor: '#E0E0E0', marginVertical: 24, marginHorizontal: 4,
  },

  dangerCard: {
    backgroundColor: '#FFF5F5', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FFCDD2', padding: 16, marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.error, marginBottom: 8, letterSpacing: 0.3,
  },
  dangerDesc:    { fontSize: 13, color: '#B71C1C', lineHeight: 19, marginBottom: 16 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.error, borderRadius: 10, paddingVertical: 13, gap: 8,
    shadowColor: COLORS.error, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  deleteBtnIcon: { fontSize: 16 },
  deleteBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  // ── Modal ─────────────────────────────────
  modalSummary:    { backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  modalHeader:     { backgroundColor: '#E8EEF8' },
  modalHeaderText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase' },
  modalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  modalRowBorder:       { borderTopWidth: 1, borderTopColor: '#E8E8E8' },
  modalCol:             { flex: 2, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  modalColRight:        { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right', color: COLORS.textPrimary },
  modalQty:             { color: COLORS.primary, fontWeight: '700' },
  modalLabel:           { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  modalValue:           { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  modalValueHighlight:  { color: COLORS.primary, fontSize: 14 },
});