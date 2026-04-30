// ─────────────────────────────────────────────
//  QuantityInput.js
//  Number input that is aware of current stock.
//  Shows a live stock badge and inline error.
//
//  Props:
//    value         {string}   — controlled value
//    onChangeText  {function} — called on every keystroke
//    currentStock  {number}   — max allowed (shown as badge)
//    label         {string}   — field label  (default: "Quantity")
//    error         {string}   — inline error message (or null)
//    editable      {bool}     — default true
//    style         {object}   — extra style for outer wrapper
// ─────────────────────────────────────────────

import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { COLORS, LOW_STOCK_THRESHOLD } from '../utils/constants';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/** Clamps a numeric string to [0, currentStock]. */
function clamp(text, max) {
  const num = parseFloat(text);
  if (isNaN(num)) return text;
  if (num < 0)    return '0';
  if (num > max)  return String(max);
  return text;
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export default function QuantityInput({
  value,
  onChangeText,
  currentStock  = 0,
  label         = 'Quantity',
  error         = null,
  editable      = true,
  style,
}) {
  const inputRef = useRef(null);

  // Determine badge colour based on remaining stock
  const stockBadgeStyle =
    currentStock === 0
      ? styles.badgeEmpty
      : currentStock <= LOW_STOCK_THRESHOLD
      ? styles.badgeLow
      : styles.badgeOk;

  const stockTextStyle =
    currentStock === 0
      ? styles.badgeTextEmpty
      : currentStock <= LOW_STOCK_THRESHOLD
      ? styles.badgeTextLow
      : styles.badgeTextOk;

  // ── Stepper helpers ───────────────────────
  function increment() {
    const current = parseFloat(value) || 0;
    const next    = Math.min(current + 1, currentStock);
    onChangeText(String(next));
  }

  function decrement() {
    const current = parseFloat(value) || 0;
    const next    = Math.max(current - 1, 0);
    onChangeText(String(next));
  }

  function handleChange(text) {
    // Strip non-numeric characters (allow single decimal point)
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    const clamped = clamp(cleaned, currentStock);
    onChangeText(clamped);
  }

  const hasError   = !!error;
  const isDisabled = !editable || currentStock === 0;

  return (
    <View style={[styles.wrapper, style]}>

      {/* ── Label row ──────────────────────── */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, hasError && styles.labelError]}>
          {label}
        </Text>

        {/* Stock badge */}
        <View style={[styles.badge, stockBadgeStyle]}>
          <Text style={[styles.badgeText, stockTextStyle]}>
            {currentStock === 0
              ? 'Out of stock'
              : `${currentStock} in stock`}
          </Text>
        </View>
      </View>

      {/* ── Input row (stepper + text field) ─ */}
      <View style={[
        styles.inputRow,
        hasError   && styles.inputRowError,
        isDisabled && styles.inputRowDisabled,
      ]}>

        {/* Minus button */}
        <TouchableOpacity
          style={[styles.stepBtn, isDisabled && styles.stepBtnDisabled]}
          onPress={decrement}
          disabled={isDisabled}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepIcon, isDisabled && styles.stepIconDisabled]}>
            −
          </Text>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={[styles.input, isDisabled && styles.inputDisabled]}
          value={value}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
          editable={editable && currentStock > 0}
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={6}
        />

        {/* Plus button */}
        <TouchableOpacity
          style={[styles.stepBtn, isDisabled && styles.stepBtnDisabled]}
          onPress={increment}
          disabled={isDisabled}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.stepIcon, isDisabled && styles.stepIconDisabled]}>
            ＋
          </Text>
        </TouchableOpacity>

      </View>

      {/* ── Inline error ───────────────────── */}
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },

  // ── Label row ────────────────────────────
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  labelError: {
    color: COLORS.error,
  },

  // ── Stock badge ───────────────────────────
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeOk: {
    backgroundColor: '#E8F5E9',
  },
  badgeLow: {
    backgroundColor: COLORS.lowStock,
  },
  badgeEmpty: {
    backgroundColor: '#EEEEEE',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badgeTextOk: {
    color: COLORS.success,
  },
  badgeTextLow: {
    color: COLORS.lowStockText,
  },
  badgeTextEmpty: {
    color: COLORS.textSecondary,
  },

  // ── Input row ─────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: COLORS.error,
  },
  inputRowDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },

  // ── Stepper buttons ───────────────────────
  stepBtn: {
    width: 44,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
  },
  stepBtnDisabled: {
    backgroundColor: '#F5F5F5',
  },
  stepIcon: {
    fontSize: 20,
    color: COLORS.primary,
    lineHeight: 24,
    fontWeight: '700',
  },
  stepIconDisabled: {
    color: '#BDBDBD',
  },

  // ── Text input ────────────────────────────
  input: {
    flex: 1,
    height: 48,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputDisabled: {
    color: COLORS.textSecondary,
  },

  // ── Inline error ─────────────────────────
  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});