// ─────────────────────────────────────────────
//  ImportStockScreen.js  (NEW)
//
//  Lets the user paste text copied from a Keva
//  stock-transfer invoice and bulk-imports it.
//
//  Rules applied automatically:
//  • "Buy 1 Get 2 Free" products → qty × 3
//  • Existing products → stock topped up
//  • New products      → created with opening stock
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
  Switch,
} from 'react-native';

import { useAppContext }      from '../context/AppContext';
import { bulkImportStock }   from '../services/productService';
import ConfirmModal          from '../components/ConfirmModal';
import { COLORS }            from '../utils/constants';

// ─────────────────────────────────────────────
//  Parser
//  Reads lines pasted from the Keva invoice PDF.
//  Expected line format (copied from PDF table):
//
//  "Agro 80 1 Ltr ( Buy 1 Get 2 Free ) np961_gst 585 557.14 20 120.00 ..."
//   ↑ product name + offer tag                        ↑ qty (6th number)
//
//  We extract:
//    productName — everything before the code (np... / bp... / ANO...)
//    isBogo      — true if "Buy 1 Get 2 Free" appears in the name
//    qty         — the Invoice Quantity column (first standalone integer
//                  that appears after the product code)
// ─────────────────────────────────────────────

const CODE_PATTERN  = /\b(np|bp|ano|apgp|NP|BP|ANO|APGP)\w+_gst\b/i;
const BOGO_PATTERN  = /buy\s*1\s*get\s*2\s*free/i;

/**
 * Parses raw pasted invoice text into an array of import items.
 *
 * @param   {string} text
 * @returns {Array<{ productName:string, qty:number, isBogo:boolean, rawQty:number }>}
 */
function parseInvoiceText(text) {
  const lines   = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];
  const seen    = new Set();

  for (const line of lines) {
    // Must contain a product code to be a product line
    const codeMatch = line.match(CODE_PATTERN);
    if (!codeMatch) continue;

    const codeIndex = line.indexOf(codeMatch[0]);
    const namePart  = line.slice(0, codeIndex).trim();

    // Strip the offer tag from display name but remember it
    const isBogo    = BOGO_PATTERN.test(namePart);
    const cleanName = namePart
      .replace(/\(\s*buy\s*1\s*get\s*2\s*free\s*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanName || cleanName.length < 2) continue;

    // Deduplicate (same product appearing in HSN summary rows)
    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Extract numbers after the code — qty is the first integer value
    const afterCode  = line.slice(codeIndex + codeMatch[0].length);
    const numbers    = afterCode.match(/\d+(\.\d+)?/g) || [];
    // numbers[0]=DP, numbers[1]=ItemRate, numbers[2]=Qty
    // Find first whole integer (no decimal) — that's the invoice qty
    let rawQty = 0;
    for (const n of numbers) {
      const num = Number(n);
      if (Number.isInteger(num) && num > 0 && num < 10000) {
        rawQty = num;
        break;
      }
    }

    if (rawQty === 0) continue;

    const finalQty = isBogo ? rawQty * 3 : rawQty;

    results.push({
      productName: cleanName,
      qty:         finalQty,
      rawQty,
      isBogo,
    });
  }

  return results;
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export default function ImportStockScreen({ navigation }) {
  const { productNames, refreshProducts } = useAppContext();

  const [rawText,       setRawText]       = useState('');
  const [parsedItems,   setParsedItems]   = useState([]);
  const [parseError,    setParseError]    = useState('');
  const [source,        setSource]        = useState('KEVA INDUSTRIES');
  const [modalVisible,  setModalVisible]  = useState(false);
  const [importing,     setImporting]     = useState(false);
  // Allow user to override BOGO multiply per item
  const [bogoOverrides, setBogoOverrides] = useState({});

  // ── Parse ─────────────────────────────────

  const handleParse = useCallback(() => {
    Keyboard.dismiss();
    setParseError('');
    setParsedItems([]);
    setBogoOverrides({});

    const text = rawText.trim();
    if (!text) {
      setParseError('Please paste the invoice text first.');
      return;
    }

    const items = parseInvoiceText(text);
    if (items.length === 0) {
      setParseError(
        'No product lines detected.\n\n' +
        'Make sure you copy the full table rows from the Keva invoice PDF ' +
        '(each row must contain the product code like np961_gst).'
      );
      return;
    }

    setParsedItems(items);
  }, [rawText]);

  // ── Toggle BOGO override per item ─────────

  const toggleBogo = useCallback((name) => {
    setBogoOverrides((prev) => {
      const current = prev[name] !== undefined ? prev[name] : true;
      return { ...prev, [name]: !current };
    });
  }, []);

  // ── Effective items (apply overrides) ─────

  const effectiveItems = parsedItems.map((item) => {
    const bogoOn =
      bogoOverrides[item.productName] !== undefined
        ? bogoOverrides[item.productName]
        : item.isBogo;
    const qty = bogoOn ? item.rawQty * 3 : item.rawQty;
    return { ...item, qty, bogoOn };
  });

  // ── Import ────────────────────────────────

  async function handleConfirmImport() {
    setImporting(true);
    try {
      await bulkImportStock(
        effectiveItems.map(({ productName, qty }) => ({ productName, qty })),
        source.trim() || 'KEVA IMPORT',
      );
      await refreshProducts();
      setModalVisible(false);
      Alert.alert(
        'Import Successful ✅',
        `${effectiveItems.length} product${effectiveItems.length !== 1 ? 's' : ''} imported successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      setModalVisible(false);
      Alert.alert('Import Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  // ── Derived flags ─────────────────────────

  const newProducts      = effectiveItems.filter(
    (i) => !productNames.some((n) => n.toLowerCase() === i.productName.toLowerCase())
  );
  const existingProducts = effectiveItems.filter(
    (i) =>  productNames.some((n) => n.toLowerCase() === i.productName.toLowerCase())
  );

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
      >

        {/* ── How-to card ──────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋  How to Import</Text>
          <StepRow n="1" text='Open the Keva invoice PDF (stock transfer)' />
          <StepRow n="2" text='Select all the product table rows and copy them' />
          <StepRow n="3" text='Paste below and tap "Read Invoice"' />
          <StepRow n="4" text='Review the parsed items, then tap "Import All"' />
          <View style={styles.bogoNote}>
            <Text style={styles.bogoNoteText}>
              🔁  <Text style={{ fontWeight: '800' }}>Buy 1 Get 2 Free</Text> products are
              automatically multiplied ×3. You can toggle this per item before importing.
            </Text>
          </View>
        </View>

        {/* ── Source label ─────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Source / Supplier Name</Text>
          <TextInput
            style={styles.input}
            value={source}
            onChangeText={setSource}
            placeholder="e.g. KEVA INDUSTRIES"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
            returnKeyType="next"
            maxLength={40}
          />
        </View>

        {/* ── Paste area ───────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>
            Paste Invoice Text <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, !!parseError && styles.inputError]}
            value={rawText}
            onChangeText={(t) => { setRawText(t); setParseError(''); setParsedItems([]); }}
            placeholder={
              'Paste the copied rows from the Keva invoice here…\n\n' +
              'Example:\nAgro 80 1 Ltr ( Buy 1 Get 2 Free ) np961_gst 585 557.14 20 120.00 …\n' +
              'Agro Neem Oil 100ml ANO100_GST 250 238.1 48 60.00 …'
            }
            placeholderTextColor={COLORS.textSecondary}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!parseError && (
            <Text style={styles.errorText}>{parseError}</Text>
          )}
        </View>

        {/* ── Parse button ─────────────────── */}
        <TouchableOpacity
          style={[styles.parseBtn, !rawText.trim() && styles.btnDisabled]}
          onPress={handleParse}
          activeOpacity={0.85}
          disabled={!rawText.trim()}
        >
          <Text style={styles.parseBtnIcon}>🔍</Text>
          <Text style={styles.parseBtnText}>Read Invoice</Text>
        </TouchableOpacity>

        {/* ── Parsed results ───────────────── */}
        {parsedItems.length > 0 && (
          <>
            {/* Summary chips */}
            <View style={styles.summaryRow}>
              <SummaryChip
                value={effectiveItems.length}
                label="Total Items"
                color={COLORS.primary}
              />
              <SummaryChip
                value={newProducts.length}
                label="New Products"
                color={COLORS.success}
              />
              <SummaryChip
                value={existingProducts.length}
                label="Stock Top-ups"
                color='#00796B'
              />
            </View>

            <Text style={styles.sectionLabel}>REVIEW ITEMS</Text>
            <Text style={styles.sectionHint}>
              Toggle ×3 switch for Buy 1 Get 2 Free items. Edit any row before importing.
            </Text>

            {effectiveItems.map((item) => {
              const isNew = !productNames.some(
                (n) => n.toLowerCase() === item.productName.toLowerCase()
              );
              return (
                <ParsedItemRow
                  key={item.productName}
                  item={item}
                  isNew={isNew}
                  onToggleBogo={() => toggleBogo(item.productName)}
                />
              );
            })}

            {/* Import button */}
            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.importBtnIcon}>📥</Text>
              <Text style={styles.importBtnText}>
                Import {effectiveItems.length} Product{effectiveItems.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Confirm modal ───────────────────── */}
      <ConfirmModal
        visible={modalVisible}
        title="Confirm Import?"
        message={
          `This will update stock for ${effectiveItems.length} product${effectiveItems.length !== 1 ? 's' : ''}.\n\n` +
          `• ${newProducts.length} new product${newProducts.length !== 1 ? 's' : ''} will be created\n` +
          `• ${existingProducts.length} existing product${existingProducts.length !== 1 ? 's' : ''} will be topped up\n\n` +
          `Source: ${source.trim() || 'KEVA IMPORT'}`
        }
        confirmLabel="Yes, Import"
        cancelLabel="Cancel"
        confirmColor={COLORS.success}
        onConfirm={handleConfirmImport}
        onCancel={() => !importing && setModalVisible(false)}
        loading={importing}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function StepRow({ n, text }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function SummaryChip({ value, label, color }) {
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function ParsedItemRow({ item, isNew, onToggleBogo }) {
  return (
    <View style={[styles.itemRow, isNew && styles.itemRowNew]}>
      {/* New / existing badge */}
      <View style={[styles.itemBadge, isNew ? styles.badgeNew : styles.badgeExisting]}>
        <Text style={styles.itemBadgeText}>{isNew ? 'NEW' : 'TOP-UP'}</Text>
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.itemQtyLabel}>
          Qty to add:{' '}
          <Text style={styles.itemQty}>{item.qty}</Text>
          {item.isBogo && (
            <Text style={styles.itemBogoNote}>
              {item.bogoOn
                ? `  (${item.rawQty} × 3)`
                : `  (${item.rawQty} — ×3 off)`}
            </Text>
          )}
        </Text>
      </View>

      {/* BOGO toggle — only show if originally flagged as BOGO */}
      {item.isBogo && (
        <View style={styles.bogoToggle}>
          <Text style={styles.bogoToggleLabel}>×3</Text>
          <Switch
            value={item.bogoOn}
            onValueChange={onToggleBogo}
            trackColor={{ false: '#E0E0E0', true: COLORS.primary + '80' }}
            thumbColor={item.bogoOn ? COLORS.primary : '#BDBDBD'}
          />
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

  // ── Info card ─────────────────────────────
  infoCard: {
    backgroundColor: '#E8EEF8', borderRadius: 14,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    padding: 14, marginBottom: 14,
  },
  infoTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.primary,
    marginBottom: 10, letterSpacing: 0.3,
  },
  stepRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  stepBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  stepNum:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 19 },

  bogoNote: {
    marginTop: 8, backgroundColor: '#FFF8E1', borderRadius: 8,
    padding: 10, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  bogoNoteText: { fontSize: 12, color: '#5D4037', lineHeight: 18 },

  // ── Form card ─────────────────────────────
  formCard: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: COLORS.textPrimary,
    marginBottom: 8, letterSpacing: 0.2,
  },
  required: { color: COLORS.error },
  input: {
    borderWidth: 1.5, borderColor: '#BDBDBD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },
  textArea:   { minHeight: 160, paddingTop: 10 },
  inputError: { borderColor: COLORS.error },
  errorText:  { marginTop: 6, fontSize: 12, color: COLORS.error, fontWeight: '500' },

  // ── Parse button ──────────────────────────
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 14, gap: 10, marginBottom: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  btnDisabled:  { backgroundColor: '#BDBDBD', shadowOpacity: 0, elevation: 0 },
  parseBtnIcon: { fontSize: 18 },
  parseBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },

  // ── Summary chips ─────────────────────────
  summaryRow: {
    flexDirection: 'row', gap: 10, marginBottom: 16,
  },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
    backgroundColor: COLORS.surface,
  },
  chipValue: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  chipLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },

  // ── Section labels ────────────────────────
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 1.2, marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 17,
  },

  // ── Parsed item rows ──────────────────────
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 12, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: '#E8E8E8',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  itemRowNew: {
    borderColor: COLORS.success + '60',
    backgroundColor: '#F1F8F1',
  },
  itemBadge: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeNew:      { backgroundColor: COLORS.success },
  badgeExisting: { backgroundColor: '#00796B' },
  itemBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  itemInfo:     { flex: 1 },
  itemName:     { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 18, marginBottom: 3 },
  itemQtyLabel: { fontSize: 12, color: COLORS.textSecondary },
  itemQty:      { fontWeight: '800', color: COLORS.textPrimary, fontSize: 13 },
  itemBogoNote: { fontSize: 11, color: COLORS.primary, fontStyle: 'italic' },

  bogoToggle:      { alignItems: 'center', gap: 2 },
  bogoToggleLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  // ── Import button ─────────────────────────
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, borderRadius: 12,
    paddingVertical: 15, gap: 10, marginTop: 8,
    shadowColor: COLORS.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  importBtnIcon: { fontSize: 20 },
  importBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.surface, letterSpacing: 0.3 },
});