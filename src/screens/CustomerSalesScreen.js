// ─────────────────────────────────────────────
//  CustomerSalesScreen.js
//
//  Two tabs: Unbilled | Billed
//  • Search by customer or product
//  • "Mark as Billed" button on every unbilled card
//  • "Edit This Sale" navigates to EditSaleScreen
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getAllTransactions, markSaleGroupAsBilled } from '../services/firebaseService';
import { COLORS, ROUTES, ENTRY_TYPE, BILLING_STATUS } from '../utils/constants';
import { parseTimestamp } from '../utils/dateHelpers';

// ─────────────────────────────────────────────
//  Grouping logic
// ─────────────────────────────────────────────

function groupIntoSales(transactions) {
  const map = {};

  transactions.forEach((tx) => {
    const key = `${tx.customerOrSource}__${tx.timestamp}`;
    if (!map[key]) {
      map[key] = {
        key,
        customerOrSource: tx.customerOrSource,
        timestamp:        tx.timestamp,
        createdAt:        tx.createdAt,
        billingStatus:    tx.billingStatus || BILLING_STATUS.BILLED,
        items:            [],
      };
    }
    map[key].items.push(tx);
  });

  return Object.values(map).sort((a, b) => {
    const dateA = parseTimestamp(a.timestamp) || new Date(0);
    const dateB = parseTimestamp(b.timestamp) || new Date(0);
    if (dateB - dateA !== 0) return dateB - dateA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function SaleCard({ group, onEdit, onMarkBilled, isMarking }) {
  const totalUnits = group.items.reduce((s, t) => s + (t.quantity || 0), 0);
  const dateStr    = group.timestamp ? group.timestamp.slice(0, 11).trim() : '';
  const timeStr    = group.timestamp ? group.timestamp.slice(11).trim()   : '';
  const isUnbilled = group.billingStatus === BILLING_STATUS.UNBILLED;

  return (
    <View style={[styles.card, isUnbilled && styles.cardUnbilled]}>

      {/* ── Card header ─────────────────── */}
      <View style={styles.cardHeader}>
        <View style={[styles.avatarCircle, isUnbilled && styles.avatarCircleUnbilled]}>
          <Text style={[styles.avatarText, isUnbilled && styles.avatarTextUnbilled]}>
            {(group.customerOrSource || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerMid}>
          <Text style={styles.customerName} numberOfLines={1}>
            {group.customerOrSource}
          </Text>
          <Text style={styles.headerTime}>
            📅 {dateStr}{'  '}🕐 {timeStr}
          </Text>
          {/* Billing badge */}
          <View style={[
            styles.billingBadge,
            isUnbilled ? styles.billingBadgeUnbilled : styles.billingBadgeBilled,
          ]}>
            <Text style={[
              styles.billingBadgeText,
              isUnbilled ? styles.billingBadgeTextUnbilled : styles.billingBadgeTextBilled,
            ]}>
              {isUnbilled ? '📋 Unbilled' : '🧾 Billed'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalUnits}>{totalUnits}</Text>
          <Text style={styles.totalSub}>units</Text>
        </View>
      </View>

      {/* ── Divider ─────────────────────── */}
      <View style={styles.divider} />

      {/* ── Product lines ───────────────── */}
      {group.items.map((tx, i) => (
        <View
          key={tx.id}
          style={[
            styles.productRow,
            i < group.items.length - 1 && styles.productRowBorder,
          ]}
        >
          <Text style={styles.productIcon}>📦</Text>
          <Text style={styles.productName} numberOfLines={2}>
            {tx.productName}
          </Text>
          <View style={styles.productRight}>
            <Text style={styles.productQty}>{tx.quantity}</Text>
            <Text style={styles.productQtyLabel}>units</Text>
          </View>
        </View>
      ))}

      {/* ── Footer buttons ──────────────── */}
      <TouchableOpacity style={styles.editSaleBtn} onPress={onEdit} activeOpacity={0.8}>
        <Text style={styles.editSaleIcon}>✏️</Text>
        <Text style={styles.editSaleText}>Edit This Sale</Text>
        <Text style={styles.editSaleChevron}>›</Text>
      </TouchableOpacity>

      {/* Mark as Billed — only for unbilled */}
      {isUnbilled && (
        <TouchableOpacity
          style={[styles.markBilledBtn, isMarking && styles.markBilledBtnDisabled]}
          onPress={onMarkBilled}
          activeOpacity={0.8}
          disabled={isMarking}
        >
          {isMarking ? (
            <ActivityIndicator size="small" color={COLORS.success} />
          ) : (
            <>
              <Text style={styles.markBilledIcon}>✅</Text>
              <Text style={styles.markBilledText}>Mark as Billed</Text>
              <Text style={styles.markBilledChevron}>›</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function DateHeader({ date, count }) {
  return (
    <View style={styles.dateHeader}>
      <Text style={styles.dateHeaderText}>{date}</Text>
      <View style={styles.dateHeaderBadge}>
        <Text style={styles.dateHeaderBadgeText}>
          {count} sale{count !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ hasSearch, activeTab }) {
  const isUnbilled = activeTab === BILLING_STATUS.UNBILLED;
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>{hasSearch ? '🔍' : isUnbilled ? '📋' : '🧾'}</Text>
      <Text style={styles.emptyTitle}>
        {hasSearch
          ? 'No matching records'
          : isUnbilled
          ? 'No unbilled sales'
          : 'No billed sales'}
      </Text>
      <Text style={styles.emptyHint}>
        {hasSearch
          ? 'Try a different customer or product name.'
          : isUnbilled
          ? 'All sales are billed, or none recorded yet.'
          : 'Billed sales will appear here once marked.'}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────

export default function CustomerSalesScreen({ navigation }) {
  const [allGroups,  setAllGroups]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [activeTab,  setActiveTab]  = useState(BILLING_STATUS.UNBILLED);
  const [marking,    setMarking]    = useState(null); // group key being marked

  // ── Load ─────────────────────────────────
  const loadSales = useCallback(async () => {
    try {
      const all   = await getAllTransactions();
      const sales = all.filter((t) => t.type === ENTRY_TYPE.SALE);
      setAllGroups(groupIntoSales(sales));
    } catch (err) {
      console.error('CustomerSalesScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSales();
    }, [loadSales]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSales();
  }, [loadSales]);

  // ── Tab counts ─────────────────────────
  const unbilledCount = allGroups.filter(
    (g) => (g.billingStatus || BILLING_STATUS.BILLED) === BILLING_STATUS.UNBILLED,
  ).length;
  const billedCount = allGroups.filter(
    (g) => (g.billingStatus || BILLING_STATUS.BILLED) === BILLING_STATUS.BILLED,
  ).length;

  // ── Filter by tab, then by search ──────
  const tabFiltered = allGroups.filter(
    (g) => (g.billingStatus || BILLING_STATUS.BILLED) === activeTab,
  );
  const q = search.trim().toLowerCase();
  const filtered = q
    ? tabFiltered.filter(
        (g) =>
          g.customerOrSource?.toLowerCase().includes(q) ||
          g.items.some((tx) => tx.productName?.toLowerCase().includes(q)),
      )
    : tabFiltered;

  // ── Group by date for section headers ───
  const dateMap = {};
  filtered.forEach((g) => {
    const dateKey = g.timestamp ? g.timestamp.slice(0, 11).trim() : 'Unknown Date';
    if (!dateMap[dateKey]) dateMap[dateKey] = [];
    dateMap[dateKey].push(g);
  });

  const sortedDateEntries = Object.entries(dateMap).sort((a, b) => {
    const parseDate = (key) => {
      const parsed = parseTimestamp(key + ' 12:00 PM');
      return parsed ? parsed.getTime() : 0;
    };
    return parseDate(b[0]) - parseDate(a[0]);
  });

  const listItems = [];
  sortedDateEntries.forEach(([date, groups]) => {
    listItems.push({ type: 'header', date, count: groups.length, key: `h-${date}` });
    groups.forEach((g) => listItems.push({ type: 'card', group: g, key: g.key }));
  });

  // ── Totals ──────────────────────────────
  const totalUnits = filtered.reduce(
    (s, g) => s + g.items.reduce((si, t) => si + (t.quantity || 0), 0),
    0,
  );

  // ── Actions ─────────────────────────────
  const handleEditGroup = (group) => {
    navigation.navigate(ROUTES.EDIT_SALE, { group });
  };

  const handleMarkBilled = async (group) => {
    setMarking(group.key);
    try {
      await markSaleGroupAsBilled(group.items);
      // Switch to Billed tab after marking
      await loadSales();
      setActiveTab(BILLING_STATUS.BILLED);
    } catch (err) {
      console.error('Mark as billed error:', err);
    } finally {
      setMarking(null);
    }
  };

  // ── Render item ─────────────────────────
  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <DateHeader date={item.date} count={item.count} />;
    }
    return (
      <SaleCard
        group={item.group}
        onEdit={() => handleEditGroup(item.group)}
        onMarkBilled={() => handleMarkBilled(item.group)}
        isMarking={marking === item.group.key}
      />
    );
  };

  return (
    <View style={styles.root}>

      {/* ── Search bar ───────────────────── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer or product…"
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {!!search && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ─────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === BILLING_STATUS.UNBILLED && styles.tabActive]}
          onPress={() => setActiveTab(BILLING_STATUS.UNBILLED)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === BILLING_STATUS.UNBILLED && styles.tabTextActive]}>
            📋 Unbilled
          </Text>
          {unbilledCount > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeUnbilled]}>
              <Text style={styles.tabBadgeText}>{unbilledCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === BILLING_STATUS.BILLED && styles.tabActive]}
          onPress={() => setActiveTab(BILLING_STATUS.BILLED)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === BILLING_STATUS.BILLED && styles.tabTextActive]}>
            🧾 Billed
          </Text>
          {billedCount > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeBilled]}>
              <Text style={styles.tabBadgeText}>{billedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Summary strip ────────────────── */}
      {!loading && filtered.length > 0 && (
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryText}>
            {filtered.length} sale{filtered.length !== 1 ? 's' : ''}
            {q ? ` matching "${search}"` : ''}
          </Text>
          <Text style={styles.summaryDot}>·</Text>
          <Text style={styles.summaryTotal}>{totalUnits} units</Text>
        </View>
      )}

      {/* ── List ─────────────────────────── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading sales records…</Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={<EmptyState hasSearch={!!q} activeTab={activeTab} />}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyFlex : styles.listContent
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // ── Search ────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon:  { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, height: 22 },
  clearBtn:    { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700' },

  // ── Tabs ──────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.surface,
    fontWeight: '800',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeUnbilled: { backgroundColor: COLORS.warning },
  tabBadgeBilled:   { backgroundColor: COLORS.success },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.surface,
  },

  // ── Summary ───────────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  summaryText:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryDot:   { color: COLORS.textSecondary, fontSize: 12 },
  summaryTotal: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // ── List ──────────────────────────────────
  listContent: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 24 },
  emptyFlex:   { flex: 1, paddingHorizontal: 12 },

  // ── Date header ───────────────────────────
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateHeaderBadge: {
    backgroundColor: '#E8EEF8',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dateHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ── Sale card ─────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardUnbilled: {
    borderLeftColor: COLORS.warning,
  },

  // ── Card header ───────────────────────────
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarCircleUnbilled: { backgroundColor: COLORS.warning },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.surface,
  },
  avatarTextUnbilled: { color: COLORS.surface },

  headerMid: { flex: 1 },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  headerTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },

  billingBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  billingBadgeBilled:   { backgroundColor: '#E8F5E9' },
  billingBadgeUnbilled: { backgroundColor: '#FFF3E0' },
  billingBadgeText:     { fontSize: 11, fontWeight: '700' },
  billingBadgeTextBilled:   { color: COLORS.success },
  billingBadgeTextUnbilled: { color: '#E65100' },

  headerRight: {
    alignItems: 'center',
    flexShrink: 0,
  },
  totalLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  totalUnits: { fontSize: 22, fontWeight: '800', color: COLORS.primary, lineHeight: 26 },
  totalSub:   { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 14 },

  // ── Product rows ──────────────────────────
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  productRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F8F8F8' },
  productIcon: { fontSize: 14 },
  productName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
    lineHeight: 18,
  },
  productRight:    { alignItems: 'flex-end' },
  productQty:      { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  productQtyLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },

  // ── Footer buttons ────────────────────────
  editSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F5F7FA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 2,
    gap: 8,
  },
  editSaleIcon:    { fontSize: 14 },
  editSaleText:    { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  editSaleChevron: { fontSize: 20, color: COLORS.textSecondary, lineHeight: 22 },

  markBilledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#E8F5E9',
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
    gap: 8,
    minHeight: 46,
    justifyContent: 'center',
  },
  markBilledBtnDisabled: { opacity: 0.6 },
  markBilledIcon:    { fontSize: 14 },
  markBilledText:    { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.success },
  markBilledChevron: { fontSize: 20, color: COLORS.success, lineHeight: 22 },

  // ── Loading ───────────────────────────────
  loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },

  // ── Empty ─────────────────────────────────
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon:  { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyHint:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});