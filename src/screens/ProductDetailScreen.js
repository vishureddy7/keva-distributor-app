// ─────────────────────────────────────────────
//  ProductDetailScreen.js  (NEW)
//  Shows full history for one product:
//    • Info card (stock numbers)
//    • Tab: Customer Purchases (SALE transactions)
//    • Tab: Stock Records     (STOCK_IN + OPENING STOCK)
//  Also has an Edit Product button → EditProductScreen
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getProductTransactions } from '../services/firebaseService';
import { COLORS, ROUTES, ENTRY_TYPE } from '../utils/constants';

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function InfoChip({ label, value, valueColor }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function TabBar({ active, onSelect }) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, active === 'sales' && styles.tabActive]}
        onPress={() => onSelect('sales')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, active === 'sales' && styles.tabTextActive]}>
          🛒 Customer Purchases
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, active === 'stock' && styles.tabActive]}
        onPress={() => onSelect('stock')}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabText, active === 'stock' && styles.tabTextActive]}>
          📦 Stock Records
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SaleRecord({ tx, index }) {
  return (
    <View style={[styles.txRow, index % 2 === 0 && styles.txRowEven]}>
      <View style={styles.txAvatarWrap}>
        <View style={styles.txAvatar}>
          <Text style={styles.txAvatarText}>
            {(tx.customerOrSource || '?')[0].toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txCustomer} numberOfLines={1}>
          {tx.customerOrSource}
        </Text>
        <Text style={styles.txTime}>{tx.timestamp}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.txQtyLabel}>Sold</Text>
        <Text style={[styles.txQty, styles.txQtySale]}>{tx.quantity}</Text>
      </View>
    </View>
  );
}

function StockRecord({ tx, index }) {
  const isOpening = tx.type === ENTRY_TYPE.OPENING_STOCK;
  return (
    <View style={[styles.txRow, index % 2 === 0 && styles.txRowEven]}>
      <View style={styles.txAvatarWrap}>
        <View style={[styles.txAvatar, styles.txAvatarStock]}>
          <Text style={styles.txAvatarText}>{isOpening ? '★' : '↑'}</Text>
        </View>
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txCustomer} numberOfLines={1}>
          {tx.customerOrSource}
        </Text>
        <Text style={styles.txTypeBadge}>{tx.type}</Text>
        <Text style={styles.txTime}>{tx.timestamp}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.txQtyLabel}>Added</Text>
        <Text style={[styles.txQty, styles.txQtyStock]}>+{tx.quantity}</Text>
      </View>
    </View>
  );
}

function EmptyTab({ label }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyText}>No {label} yet</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function ProductDetailScreen({ route, navigation }) {
  const { product } = route.params;

  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState('sales');

  // ── Load transactions ─────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const txs = await getProductTransactions(product.productName);
      setTransactions(txs);
    } catch (err) {
      console.error('ProductDetailScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, [product.productName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Split transactions ────────────────────
  const salesTxs = transactions.filter((t) => t.type === ENTRY_TYPE.SALE);
  const stockTxs = transactions.filter((t) =>
    t.type === ENTRY_TYPE.STOCK_IN || t.type === ENTRY_TYPE.OPENING_STOCK,
  );

  // ── Customer summary (for sales tab) ─────
  const customerMap = {};
  salesTxs.forEach((tx) => {
    const name = tx.customerOrSource;
    if (!customerMap[name]) customerMap[name] = 0;
    customerMap[name] += tx.quantity;
  });
  const topCustomers = Object.entries(customerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >

        {/* ── Product info card ────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.productNameText} numberOfLines={2}>
            {product.productName}
          </Text>
          <View style={styles.chipsRow}>
            <InfoChip
              label="Current"
              value={product.currentStock}
              valueColor={
                product.currentStock === 0
                  ? COLORS.error
                  : product.currentStock <= 5
                  ? COLORS.warning
                  : COLORS.success
              }
            />
            <View style={styles.chipDivider} />
            <InfoChip label="Total In"   value={product.totalStockIn} />
            <View style={styles.chipDivider} />
            <InfoChip label="Total Sold" value={product.totalSold} />
          </View>
          <Text style={styles.lastUpdated}>Last updated: {product.lastUpdated}</Text>
        </View>

        {/* ── Edit product button ──────────── */}
        <TouchableOpacity
          style={styles.editProductBtn}
          onPress={() => navigation.navigate(ROUTES.EDIT_PRODUCT, { product })}
          activeOpacity={0.85}
        >
          <Text style={styles.editProductIcon}>✏️</Text>
          <Text style={styles.editProductText}>Rename / Delete Product</Text>
          <Text style={styles.editProductChevron}>›</Text>
        </TouchableOpacity>

        {/* ── Top customers (shown only on sales tab) ── */}
        {activeTab === 'sales' && !loading && topCustomers.length > 0 && (
          <View style={styles.topCustomersCard}>
            <Text style={styles.topCustomersTitle}>Top Customers</Text>
            {topCustomers.map(([name, total], i) => (
              <View key={name} style={[styles.topRow, i < topCustomers.length - 1 && styles.topRowBorder]}>
                <Text style={styles.topRank}>#{i + 1}</Text>
                <Text style={styles.topName} numberOfLines={1}>{name}</Text>
                <Text style={styles.topUnits}>{total} units</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Tabs ─────────────────────────── */}
        <TabBar active={activeTab} onSelect={setActiveTab} />

        {/* ── Tab content ──────────────────── */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : activeTab === 'sales' ? (
          salesTxs.length === 0 ? (
            <EmptyTab label="customer purchases" />
          ) : (
            <View style={styles.txList}>
              <View style={styles.txListHeader}>
                <Text style={styles.txListHeaderText}>CUSTOMER</Text>
                <Text style={styles.txListHeaderTextRight}>QTY</Text>
              </View>
              {salesTxs.map((tx, i) => (
                <SaleRecord key={tx.id} tx={tx} index={i} />
              ))}
            </View>
          )
        ) : (
          stockTxs.length === 0 ? (
            <EmptyTab label="stock records" />
          ) : (
            <View style={styles.txList}>
              <View style={styles.txListHeader}>
                <Text style={styles.txListHeaderText}>SOURCE</Text>
                <Text style={styles.txListHeaderTextRight}>QTY</Text>
              </View>
              {stockTxs.map((tx, i) => (
                <StockRecord key={tx.id} tx={tx} index={i} />
              ))}
            </View>
          )
        )}

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
  scroll: { padding: 14 },

  // ── Info card ─────────────────────────────
  infoCard: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    padding: 18, marginBottom: 12,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  productNameText: {
    fontSize: 18, fontWeight: '800', color: COLORS.surface,
    marginBottom: 14, letterSpacing: 0.2,
  },
  chipsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingVertical: 10,
  },
  chip: { flex: 1, alignItems: 'center' },
  chipValue: {
    fontSize: 22, fontWeight: '800', color: COLORS.surface, lineHeight: 26,
  },
  chipLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2,
  },
  chipDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  lastUpdated: {
    fontSize: 11, color: 'rgba(255,255,255,0.65)',
    marginTop: 10, textAlign: 'right',
  },

  // ── Edit product button ───────────────────
  editProductBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
    gap: 10,
  },
  editProductIcon:    { fontSize: 16 },
  editProductText:    { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.primary },
  editProductChevron: { fontSize: 20, color: COLORS.textSecondary },

  // ── Top customers card ────────────────────
  topCustomersCard: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  topCustomersTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, gap: 10,
  },
  topRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  topRank: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, width: 24 },
  topName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  topUnits: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  // ── Tabs ──────────────────────────────────
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 4, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 9,
  },
  tabActive:      { backgroundColor: COLORS.primary },
  tabText:        { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive:  { color: COLORS.surface, fontWeight: '700' },

  // ── Transaction list ──────────────────────
  txList: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  txListHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#E8EEF8', paddingHorizontal: 14, paddingVertical: 8,
  },
  txListHeaderText:      { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  txListHeaderTextRight: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  txRowEven: { backgroundColor: '#FAFBFF' },

  txAvatarWrap: { marginRight: 12 },
  txAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8EEF8', alignItems: 'center', justifyContent: 'center',
  },
  txAvatarStock:  { backgroundColor: '#E8F5E9' },
  txAvatarText:   { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  txMid:     { flex: 1 },
  txCustomer: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  txTypeBadge: {
    alignSelf: 'flex-start',
    fontSize: 10, fontWeight: '700', color: COLORS.success,
    backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4, marginBottom: 2,
  },
  txTime: { fontSize: 11, color: COLORS.textSecondary },

  txRight:    { alignItems: 'flex-end', minWidth: 48 },
  txQtyLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  txQty:      { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  txQtySale:  { color: COLORS.error },
  txQtyStock: { color: COLORS.success },

  // ── Loading / Empty ───────────────────────
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyBox:   { paddingVertical: 40, alignItems: 'center' },
  emptyIcon:  { fontSize: 36, marginBottom: 10 },
  emptyText:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
});