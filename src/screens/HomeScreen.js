// ─────────────────────────────────────────────
//  HomeScreen.js
//  Import Stock → Customer Sales Records
// ─────────────────────────────────────────────

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppContext }      from '../context/AppContext';
import { COLORS, ROUTES, LOW_STOCK_THRESHOLD } from '../utils/constants';
import { getTodayDisplay }    from '../utils/dateHelpers';

// ─────────────────────────────────────────────
//  Action button config
// ─────────────────────────────────────────────

const ACTIONS = [
  {
    route:    ROUTES.RECORD_SALE,
    icon:     '📦',
    label:    'Record Sale',
    sublabel: 'Log a customer purchase',
    accent:   COLORS.primary,
  },
  {
    route:    ROUTES.RESTOCK,
    icon:     '🚚',
    label:    'Add Stock',
    sublabel: 'Record incoming inventory',
    accent:   '#00796B',
  },
  {
    route:    ROUTES.CUSTOMER_SALES,
    icon:     '🧾',
    label:    'Customer Sales Records',
    sublabel: 'View & edit past sales',
    accent:   '#6A1B9A',
  },
  {
    route:    ROUTES.ADD_PRODUCT,
    icon:     '➕',
    label:    'Add New Product',
    sublabel: 'Expand your catalogue',
    accent:   COLORS.accent,
  },
  {
    route:    ROUTES.VIEW_STOCK,
    icon:     '📊',
    label:    'View Stock',
    sublabel: 'Live inventory overview',
    accent:   '#00838F',
  },
  {
    route:    ROUTES.EXCEL_VIEW,
    icon:     '📁',
    label:    'View / Export Excel',
    sublabel: 'Save or share the .xlsx file',
    accent:   '#37474F',
  },
];

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function ActionCard({ action, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: action.accent }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.cardBlob, { backgroundColor: action.accent + '18' }]} />
      <Text style={styles.cardIcon}>{action.icon}</Text>
      <View style={styles.cardTextGroup}>
        <Text style={[styles.cardLabel, { color: action.accent }]}>
          {action.label}
        </Text>
        <Text style={styles.cardSublabel}>{action.sublabel}</Text>
      </View>
      <Text style={[styles.chevron, { color: action.accent }]}>›</Text>
    </TouchableOpacity>
  );
}

function StatChip({ value, label, valueColor }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { products, loading, refreshProducts } = useAppContext();

  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts]),
  );

  const totalProducts  = products.length;
  const lowStockCount  = products.filter(
    (p) => p.currentStock <= LOW_STOCK_THRESHOLD && p.currentStock > 0,
  ).length;
  const outOfStock     = products.filter((p) => p.currentStock === 0).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header banner ───────────────── */}
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerTitle}>Keva Distributor</Text>
            <Text style={styles.bannerDate}>📅 {getTodayDisplay()}</Text>
          </View>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>v1.0</Text>
          </View>
        </View>

        {/* ── Quick stats ─────────────────── */}
        <View style={styles.statsRow}>
          <StatChip
            value={loading ? '—' : totalProducts}
            label="Products"
          />
          <View style={styles.statsDivider} />
          <StatChip
            value={loading ? '—' : lowStockCount}
            label="Low Stock"
            valueColor={lowStockCount > 0 ? COLORS.warning : COLORS.success}
          />
          <View style={styles.statsDivider} />
          <StatChip
            value={loading ? '—' : outOfStock}
            label="Out of Stock"
            valueColor={outOfStock > 0 ? COLORS.error : COLORS.success}
          />
        </View>

        {/* ── Alert strip ─────────────────── */}
        {!loading && (outOfStock > 0 || lowStockCount > 0) && (
          <TouchableOpacity
            style={[
              styles.alertStrip,
              outOfStock > 0 ? styles.alertError : styles.alertWarning,
            ]}
            onPress={() => navigation.navigate(ROUTES.VIEW_STOCK)}
            activeOpacity={0.8}
          >
            <Text style={styles.alertIcon}>
              {outOfStock > 0 ? '🚨' : '⚠️'}
            </Text>
            <Text style={styles.alertText}>
              {outOfStock > 0
                ? `${outOfStock} product${outOfStock > 1 ? 's' : ''} out of stock — tap to view`
                : `${lowStockCount} product${lowStockCount > 1 ? 's' : ''} running low — tap to view`}
            </Text>
            <Text style={styles.alertChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Section label ───────────────── */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

        {/* ── Action cards ────────────────── */}
        {ACTIONS.map((action) => (
          <ActionCard
            key={action.route}
            action={action}
            onPress={() => navigation.navigate(action.route)}
          />
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 16 },

  banner: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  bannerTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.surface,
    letterSpacing: 0.3, marginBottom: 4,
  },
  bannerDate:  { fontSize: 13, color: 'rgba(255,255,255,0.78)', letterSpacing: 0.2 },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 4, marginTop: 2,
  },
  bannerBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.surface, letterSpacing: 0.5 },

  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: -14,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 5,
  },
  chip:       { flex: 1, alignItems: 'center' },
  chipValue:  { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 26 },
  chipLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginTop: 2, letterSpacing: 0.2 },
  statsDivider: { width: 1, height: 32, backgroundColor: '#E0E0E0' },

  alertStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 14, gap: 8,
  },
  alertError:   { backgroundColor: '#FFEBEE', borderLeftWidth: 4, borderLeftColor: COLORS.error },
  alertWarning: { backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  alertIcon:    { fontSize: 16 },
  alertText:    { flex: 1, fontSize: 13, color: COLORS.textPrimary, fontWeight: '500', lineHeight: 18 },
  alertChevron: { fontSize: 20, color: COLORS.textSecondary, lineHeight: 22 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 24, marginBottom: 10, marginHorizontal: 20,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginBottom: 10, borderRadius: 12,
    borderLeftWidth: 4, paddingVertical: 16, paddingHorizontal: 16,
    gap: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardBlob: {
    position: 'absolute', right: -20, top: -20,
    width: 90, height: 90, borderRadius: 45,
  },
  cardIcon:      { fontSize: 28, lineHeight: 34, width: 36, textAlign: 'center' },
  cardTextGroup: { flex: 1 },
  cardLabel:     { fontSize: 15, fontWeight: '700', letterSpacing: 0.2, marginBottom: 2 },
  cardSublabel:  { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  chevron:       { fontSize: 26, lineHeight: 28, fontWeight: '300', marginRight: 2 },
});