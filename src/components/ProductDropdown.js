// ─────────────────────────────────────────────
//  ProductDropdown.js
//
//  FIXES:
//   1. listMode="MODAL" — opens the list in a real
//      Modal overlay, completely independent of the
//      parent ScrollView. Scroll works natively.
//   2. Product names no longer clip — the modal list
//      has full height and no parent constraint.
//   3. Deselection bug fixed — internal state with
//      functional updater so multi-select never loses
//      previously selected items.
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';

import { COLORS } from '../utils/constants';

export default function ProductDropdown({
  mode            = 'single',
  items           = [],
  value,
  onValueChange,
  label           = 'Product',
  placeholder     = 'Select a product…',
  error           = null,
  disabled        = false,
  zIndex          = 1000,
  zIndexInverse   = 2000,
}) {
  const [open, setOpen] = useState(false);

  // ── Internal state — prevents stale closure in
  //    setValue callback (fixes deselection bug) ──
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const pickerItems = items.map((name) => ({ label: name, value: name }));

  const isMulti  = mode === 'multi';
  const hasError = !!error;

  const handleOpen = useCallback((isOpen) => setOpen(isOpen), []);
  const handleDone = useCallback(() => setOpen(false), []);

  // ── Placeholder text for multi mode ───────
  const multiPlaceholder = (() => {
    if (!isMulti) return placeholder;
    const count = Array.isArray(internalValue) ? internalValue.length : 0;
    if (count === 0) return placeholder;
    return count === 1 ? '1 product selected' : `${count} products selected`;
  })();

  return (
    <View style={styles.wrapper}>

      {/* ── Label ─────────────────────────── */}
      {!!label && (
        <Text style={[styles.label, hasError && styles.labelError]}>
          {label}
          {isMulti && (
            <Text style={styles.labelHint}> (select one or more)</Text>
          )}
        </Text>
      )}

      {/* ── Picker ────────────────────────── */}
      <DropDownPicker
        open={open}
        setOpen={handleOpen}

        value={internalValue}
        setValue={(callback) => {
          setInternalValue((prev) => {
            const next = typeof callback === 'function' ? callback(prev) : callback;
            onValueChange(next);
            return next;
          });
        }}

        items={pickerItems}
        multiple={isMulti}
        mode="SIMPLE"

        placeholder={isMulti ? multiPlaceholder : placeholder}
        placeholderStyle={
          isMulti && Array.isArray(internalValue) && internalValue.length > 0
            ? styles.placeholderSelected
            : styles.placeholder
        }
        disabled={disabled}

        style={[
          styles.picker,
          hasError && styles.pickerError,
          disabled && styles.pickerDisabled,
        ]}
        containerStyle={styles.container}

        // ── KEY FIX: Modal mode ───────────────
        // Opens the list in a true RN Modal above the
        // entire screen — no parent ScrollView conflict,
        // full native scroll, no clipping.
        listMode="MODAL"
        modalProps={{
          animationType: 'fade',
          statusBarTranslucent: true,
        }}
        modalContentContainerStyle={styles.modalContent}
        modalTitle={isMulti ? 'Select Products' : 'Select Product'}
        modalTitleStyle={styles.modalTitle}

        // Search
        searchable
        searchPlaceholder="Search products…"
        searchContainerStyle={styles.searchContainer}
        searchTextInputStyle={styles.searchInput}

        // Item styles
        listItemContainerStyle={styles.listItem}
        listItemLabelStyle={styles.listItemLabel}
        selectedItemContainerStyle={styles.selectedItem}
        selectedItemLabelStyle={styles.selectedItemLabel}
        tickIconStyle={styles.tickIcon}
        arrowIconStyle={styles.arrowIcon}

        textStyle={styles.pickerText}
        labelStyle={styles.pickerLabel}

        zIndex={zIndex}
        zIndexInverse={zIndexInverse}

        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No products found.</Text>
            <Text style={styles.emptyHint}>Add a product first.</Text>
          </View>
        )}

        // Done button inside modal for multi mode
        ListFooterComponent={isMulti ? () => (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>✓  Done Selecting</Text>
          </TouchableOpacity>
        ) : null}

        closeAfterSelecting={!isMulti}
        showTickIcon
      />

      {/* ── Selected chips (multi, closed) ── */}
      {isMulti && !open && Array.isArray(internalValue) && internalValue.length > 0 && (
        <View style={styles.selectedChipsRow}>
          {internalValue.slice(0, 3).map((v) => (
            <View key={v} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{v}</Text>
            </View>
          ))}
          {internalValue.length > 3 && (
            <View style={[styles.chip, styles.chipMore]}>
              <Text style={styles.chipMoreText}>+{internalValue.length - 3} more</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Inline error ──────────────────── */}
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const BORDER_RADIUS = 10;
const BORDER_COLOR  = '#BDBDBD';

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  labelError: { color: COLORS.error },
  labelHint:  { fontSize: 12, fontWeight: '400', color: COLORS.textSecondary },

  container: {},

  picker: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.surface,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  pickerError:    { borderColor: COLORS.error },
  pickerDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },

  // ── Modal list styles ─────────────────────
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  listItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 52,
    // height: auto so long names wrap naturally
  },
  listItemLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
    flexWrap: 'wrap',
    flexShrink: 1,
    lineHeight: 21,
  },

  selectedItem:      { backgroundColor: '#E8EEF8' },
  selectedItemLabel: { color: COLORS.primary, fontWeight: '700' },

  tickIcon:  { tintColor: COLORS.primary, width: 18, height: 18 },
  arrowIcon: { tintColor: COLORS.textSecondary, width: 18, height: 18 },

  pickerText:          { fontSize: 15, color: COLORS.textPrimary },
  pickerLabel:         { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  placeholder:         { color: COLORS.textSecondary, fontSize: 15 },
  placeholderSelected: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  searchContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    height: 42,
  },

  emptyBox:  { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: COLORS.textSecondary },

  // ── Done button (multi modal footer) ──────
  doneBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    borderRadius: 10,
  },
  doneBtnText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // ── Selected chips (closed multi state) ───
  selectedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#E8EEF8',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 180,
  },
  chipText:     { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  chipMore:     { backgroundColor: '#F0F0F0' },
  chipMoreText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});