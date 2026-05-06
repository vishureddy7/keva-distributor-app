// ─────────────────────────────────────────────
//  ConfirmModal.js
//  Reusable confirmation dialog shown before
//  any destructive / write operation.
//
//  FIX: message + children now scroll inside the
//  card so the action buttons are always visible
//  regardless of how long the product list is.
//
//  Props:
//    visible       {bool}     — controls visibility
//    title         {string}   — modal heading
//    message       {string}   — body text / summary
//    confirmLabel  {string}   — confirm button label  (default: "Confirm")
//    cancelLabel   {string}   — cancel button label   (default: "Cancel")
//    confirmColor  {string}   — confirm button colour (default: primary blue)
//    onConfirm     {function} — called when user taps confirm
//    onCancel      {function} — called when user taps cancel / backdrop
//    loading       {bool}     — shows spinner on confirm button while writing
// ─────────────────────────────────────────────

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from 'react-native';

import { COLORS } from '../utils/constants';

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export default function ConfirmModal({
  visible       = false,
  title         = 'Confirm Action',
  message       = '',
  confirmLabel  = 'Confirm',
  cancelLabel   = 'Cancel',
  confirmColor  = COLORS.primary,
  onConfirm,
  onCancel,
  loading       = false,
  children,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onCancel}
    >
      {/* Dim backdrop — tap to cancel */}
      <TouchableWithoutFeedback onPress={loading ? undefined : onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Card */}
      <View style={styles.centreWrapper} pointerEvents="box-none">
        <View style={styles.card}>

          {/* ── Title ─────────────────────────── */}
          <Text style={styles.title}>{title}</Text>

          {/* ── Divider ───────────────────────── */}
          <View style={styles.divider} />

          {/* ── Scrollable body ───────────────── */}
          {/* maxHeight caps the scroll area so buttons always show */}
          {(!!message || !!children) && (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {!!message && (
                <Text style={styles.message}>{message}</Text>
              )}
              {!!children && (
                <View style={styles.childrenWrapper}>{children}</View>
              )}
            </ScrollView>
          )}

          {/* ── Buttons — always visible ───────── */}
          <View style={styles.buttonRow}>
            {/* Cancel */}
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            {/* Confirm */}
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.surface} />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Backdrop ──────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.50)',
  },

  // ── Centering wrapper ─────────────────────
  centreWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  // ── Card ──────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,

    // Shadow — iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    // Shadow — Android
    elevation: 10,
  },

  // ── Title ─────────────────────────────────
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  // ── Divider ───────────────────────────────
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 14,
  },

  // ── Scrollable area ───────────────────────
  // maxHeight ensures the button row is always visible
  // even when the product table is very long
  scrollArea: {
    maxHeight: 320,
  },
  scrollContent: {
    paddingBottom: 4,
  },

  // ── Message ───────────────────────────────
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: 6,
  },

  // ── Optional children ─────────────────────
  childrenWrapper: {
    marginTop: 4,
    marginBottom: 4,
  },

  // ── Button row — always at bottom ─────────
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 10,
  },

  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cancel — ghost style
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Confirm — filled
  confirmBtn: {
    // backgroundColor set inline via confirmColor prop
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.surface,
    letterSpacing: 0.2,
  },
});