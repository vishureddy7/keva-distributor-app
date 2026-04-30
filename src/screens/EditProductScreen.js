// ─────────────────────────────────────────────
//  EditProductScreen.js  (UPDATED)
//  Added: Delete Product button + confirm modal
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
  Alert,
} from 'react-native';

import { useAppContext }    from '../context/AppContext';
import { renameProduct }   from '../services/productService';
import { deleteProduct }   from '../services/productService';
import ConfirmModal        from '../components/ConfirmModal';
import { COLORS }          from '../utils/constants';
import { validateProductName } from '../utils/validators';

export default function EditProductScreen({ route, navigation }) {
  const { product } = route.params;
  const { productNames, refreshProducts } = useAppContext();

  const [newName,       setNewName]       = useState(product.productName);
  const [nameError,     setNameError]     = useState('');

  // Rename modal
  const [renameVisible, setRenameVisible] = useState(false);
  const [saving,        setSaving]        = useState(false);

  // Delete modal
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const otherNames = productNames.filter(
    (n) => n.toLowerCase() !== product.productName.toLowerCase()
  );

  // ── Rename handlers ───────────────────────

  function handleNameChange(text) {
    setNewName(text);
    if (nameError) setNameError('');
  }

  function handlePreviewRename() {
    Keyboard.dismiss();
    const trimmed = newName.trim();

    if (trimmed === product.productName) {
      Alert.alert('No Change', 'The product name is the same as before.');
      return;
    }

    const check = validateProductName(trimmed, otherNames);
    if (!check.valid) {
      setNameError(check.error);
      return;
    }

    setRenameVisible(true);
  }

  async function handleConfirmRename() {
    setSaving(true);
    try {
      await renameProduct(product.productName, newName.trim());
      await refreshProducts();
      setRenameVisible(false);
      navigation.goBack();
    } catch (err) {
      setRenameVisible(false);
      setNameError(err.message || 'Failed to rename product. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handlers ───────────────────────

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteProduct(product.productName);
      await refreshProducts();
      setDeleteVisible(false);
      // Go back to ViewStock after deletion
      navigation.goBack();
    } catch (err) {
      setDeleteVisible(false);
      Alert.alert('Delete Failed', err.message || 'Could not delete product. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const isChanged = newName.trim() !== product.productName && newName.trim().length >= 2;

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

        {/* ── Warning strip ────────────────── */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Renaming updates all future records. Past transaction history in Firestore
            stays linked to the old name — the Excel export will reflect the new name going forward.
          </Text>
        </View>

        {/* ── Current info card ────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Current Details</Text>
          <InfoRow label="Product Name"   value={product.productName} />
          <InfoRow label="Current Stock"  value={String(product.currentStock)} />
          <InfoRow label="Total Stock In" value={String(product.totalStockIn)} />
          <InfoRow label="Total Sold"     value={String(product.totalSold)} isLast />
        </View>

        {/* ── Rename form ──────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Rename Product</Text>

          <Text style={[styles.label, !!nameError && styles.labelError]}>
            New Product Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, !!nameError && styles.inputError]}
            value={newName}
            onChangeText={handleNameChange}
            placeholder="Enter new product name"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handlePreviewRename}
            autoFocus
          />
          {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
          <Text style={styles.hint}>Min 2 characters · Must be unique · Case-insensitive</Text>
        </View>

        {/* ── Rename button ────────────────── */}
        <TouchableOpacity
          style={[styles.renameBtn, !isChanged && styles.submitBtnDisabled]}
          onPress={handlePreviewRename}
          activeOpacity={0.85}
          disabled={!isChanged}
        >
          <Text style={styles.submitIcon}>✏️</Text>
          <Text style={styles.submitText}>Save New Name</Text>
        </TouchableOpacity>

        {/* ── Divider ──────────────────────── */}
        <View style={styles.divider} />

        {/* ── Danger zone ──────────────────── */}
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠ Danger Zone</Text>
          <Text style={styles.dangerDesc}>
            Permanently removes this product from the inventory. Transaction
            history will be kept for audit purposes, but the product will no
            longer appear in stock or dropdowns.
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setDeleteVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.deleteBtnIcon}>🗑️</Text>
            <Text style={styles.deleteBtnText}>Delete Product</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Rename confirm modal ─────────────── */}
      <ConfirmModal
        visible={renameVisible}
        title="Rename Product?"
        message=""
        confirmLabel="Yes, Rename"
        cancelLabel="Cancel"
        confirmColor={COLORS.warning}
        onConfirm={handleConfirmRename}
        onCancel={() => !saving && setRenameVisible(false)}
        loading={saving}
      >
        <View style={styles.modalSummary}>
          <ModalRow label="From" value={product.productName} />
          <ModalRow label="To"   value={newName.trim()} highlight isLast />
        </View>
      </ConfirmModal>

      {/* ── Delete confirm modal ─────────────── */}
      <ConfirmModal
        visible={deleteVisible}
        title="Delete Product?"
        message={
          `"${product.productName}" will be permanently removed from inventory.\n\n` +
          `Current stock: ${product.currentStock} unit${product.currentStock !== 1 ? 's' : ''}\n` +
          `This action cannot be undone.`
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
//  Sub-components
// ─────────────────────────────────────────────

function InfoRow({ label, value, isLast }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ModalRow({ label, value, isLast, highlight }) {
  return (
    <View style={[styles.modalRow, !isLast && styles.modalRowBorder]}>
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

  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFF8E1', borderRadius: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.warning,
    padding: 12, marginBottom: 14, gap: 10,
  },
  warningIcon: { fontSize: 16 },
  warningText: { flex: 1, fontSize: 12, color: '#795548', lineHeight: 18 },

  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  infoCardTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, alignItems: 'center',
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: {
    fontSize: 14, color: COLORS.textPrimary, fontWeight: '700',
    maxWidth: '55%', textAlign: 'right',
  },

  formCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },

  label:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  labelError: { color: COLORS.error },
  required:   { color: COLORS.error },
  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  inputError:  { borderColor: COLORS.error },
  errorText:   { marginTop: 5, fontSize: 12, color: COLORS.error, fontWeight: '500' },
  hint:        { marginTop: 5, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },

  // ── Rename button ─────────────────────────
  renameBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.warning, borderRadius: 12, paddingVertical: 15, gap: 10,
    shadowColor: COLORS.warning, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  submitIcon: { fontSize: 18 },
  submitText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  // ── Divider ───────────────────────────────
  divider: {
    height: 1, backgroundColor: '#E0E0E0',
    marginVertical: 24, marginHorizontal: 4,
  },

  // ── Danger zone ───────────────────────────
  dangerCard: {
    backgroundColor: '#FFF5F5', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FFCDD2',
    padding: 16, marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.error,
    marginBottom: 8, letterSpacing: 0.3,
  },
  dangerDesc: {
    fontSize: 13, color: '#B71C1C', lineHeight: 19, marginBottom: 16,
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.error, borderRadius: 10, paddingVertical: 13, gap: 8,
    shadowColor: COLORS.error, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  deleteBtnIcon: { fontSize: 16 },
  deleteBtnText: {
    fontSize: 15, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3,
  },

  // ── Modal ─────────────────────────────────
  modalSummary: {
    backgroundColor: '#F5F7FA', borderRadius: 8, overflow: 'hidden', marginTop: 4,
  },
  modalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  modalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#E8E8E8' },
  modalLabel:     { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  modalValue: {
    fontSize: 13, color: COLORS.textPrimary, fontWeight: '700',
    maxWidth: '60%', textAlign: 'right',
  },
  modalValueHighlight: { color: COLORS.warning, fontSize: 14 },
});