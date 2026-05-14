// ─────────────────────────────────────────────
//  ProductDropdown.js
//
//  FIXES:
//   1. Scroll inside dropdown now works — flatListProps +
//      scrollViewProps both set nestedScrollEnabled: true.
//   2. Multi mode no longer shows selected badges floating
//      at the top of the list. Selected items stay in their
//      original position; a "X selected" chip shows instead.
//   3. Done button retained for multi mode.
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
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

  const pickerItems = items.map((name) => ({ label: name, value: name }));

  const isMulti  = mode === 'multi';
  const hasError = !!error;

  const handleOpen = useCallback((isOpen) => setOpen(isOpen), []);
  const handleDone = useCallback(() => setOpen(false), []);

  // ── Multi mode: build placeholder text ────
  const multiPlaceholder = (() => {
    if (!isMulti) return placeholder;
    const count = Array.isArray(value) ? value.length : 0;
    if (count === 0) return placeholder;
    if (count === 1) return `1 product selected`;
    return `${count} products selected`;
  })();

  return (
    <View style={[styles.wrapper, { zIndex, elevation: zIndex }]}>

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
        value={value}
        setValue={(callback) => {
          const newValue = typeof callback === 'function' ? callback(value) : callback;
          onValueChange(newValue);
        }}
        items={pickerItems}
        multiple={isMulti}
        // SIMPLE mode keeps selected items in their original
        // list position (BADGE moves them to top — avoid).
        mode="SIMPLE"

        placeholder={isMulti ? multiPlaceholder : placeholder}
        placeholderStyle={
          isMulti && Array.isArray(value) && value.length > 0
            ? styles.placeholderSelected
            : styles.placeholder
        }
        disabled={disabled}

        style={[
          styles.picker,
          hasError  && styles.pickerError,
          disabled  && styles.pickerDisabled,
          open      && styles.pickerOpen,
        ]}
        containerStyle={styles.container}
        dropDownContainerStyle={[
          styles.dropdownContainer,
          { zIndex: zIndex + 10, elevation: zIndex + 10 },
        ]}

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

        searchable={items.length > 8}
        searchPlaceholder="Search products…"
        searchContainerStyle={styles.searchContainer}
        searchTextInputStyle={styles.searchInput}

        // ── KEY FIX: enable nested scroll ──
        flatListProps={{ nestedScrollEnabled: true }}
        scrollViewProps={{ nestedScrollEnabled: true }}

        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No products found.</Text>
            <Text style={styles.emptyHint}>Add a product first.</Text>
          </View>
        )}

        // ── Done button for multi mode ─────
        ListFooterComponent={isMulti && open ? () => (
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
        maxHeight={300}
      />

      {/* ── Selected chips summary (multi only, closed state) ── */}
      {isMulti && !open && Array.isArray(value) && value.length > 0 && (
        <View style={styles.selectedChipsRow}>
          {value.slice(0, 3).map((v) => (
            <View key={v} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{v}</Text>
            </View>
          ))}
          {value.length > 3 && (
            <View style={[styles.chip, styles.chipMore]}>
              <Text style={styles.chipMoreText}>+{value.length - 3} more</Text>
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
  labelHint: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },

  container: {},

  picker: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: BORDER_RADIUS,
    backgroundColor: COLORS.surface,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  pickerOpen: {
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  pickerError:    { borderColor: COLORS.error },
  pickerDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },

  dropdownContainer: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderTopWidth: 0,
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },

  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    height: 'auto',
    minHeight: 48,
    alignItems: 'center',
  },
  listItemLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  selectedItem:      { backgroundColor: '#E8EEF8' },
  selectedItemLabel: { color: COLORS.primary, fontWeight: '700' },

  tickIcon:  { tintColor: COLORS.primary, width: 16, height: 16 },
  arrowIcon: { tintColor: COLORS.textSecondary, width: 18, height: 18 },

  pickerText:        { fontSize: 15, color: COLORS.textPrimary },
  pickerLabel:       { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  placeholder:       { color: COLORS.textSecondary, fontSize: 15 },
  placeholderSelected: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  searchContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingHorizontal: 10,
    height: 38,
  },

  emptyBox:  { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: COLORS.textSecondary },

  // ── Done button ───────────────────────────
  doneBtn: {
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#4A7FCC',
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  doneBtnText: {
    color: COLORS.surface,
    fontSize: 14,
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
    maxWidth: 160,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  chipMore: {
    backgroundColor: '#F0F0F0',
  },
  chipMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});