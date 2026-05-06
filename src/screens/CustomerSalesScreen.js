// ─────────────────────────────────────────────
//  CustomerSalesScreen.js
//
//  CHANGES:
//   • Tapping any part of a sale card (header or
//     "Edit Sale" button) now navigates to
//     EditSaleScreen with the FULL group — so the
//     user can edit customer name, date/time, add
//     products, delete products, and edit quantities.
//   • Individual product rows are no longer tappable
//     (editing is done at the group level).
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

import { getAllTransactions } from '../services/firebaseService';
import { COLORS, ROUTES, ENTRY_TYPE } from '../utils/constants';

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
        items:            [],
      };
    }
    map[key].items.push(tx);
  });

  return Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function SaleCard({ group, onEdit }) {
  const totalUnits = group.items.reduce((s, t) => s + (t.quantity || 0), 0);
  const dateStr    = group.timestamp ? group.timestamp.slice(0, 11).trim() : '';
  const timeStr    = group.timestamp ? group.timestamp.slice(11).trim()   : '';

  return (
    <View style={styles.card}>

      {/* ── Card header: customer + date ── */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
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
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalUnits}>{totalUnits}</Text>
          <Text style={styles.totalSub}>units</Text>
        </View>
      </View>

      {/* ── Divider ───────────────────── */}
      <View style={styles.divider} />

      {/* ── Product lines (read-only display) ─ */}
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

      {/* ── Footer: edit button ─────────── */}
      <TouchableOpacity style={styles.editSaleBtn} onPress={onEdit} activeOpacity={0.8}>
        <Text style={styles.editSaleIcon}>✏️</Text>
        <Text style={styles.editSaleText}>Edit This Sale</Text>
        <Text style={styles.editSaleChevron}>›</Text>
      </TouchableOpacity>

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

function EmptyState({ hasSearch }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>{hasSearch ? '🔍' : '🧾'}</Text>
      <Text style={styles.emptyTitle}>
        {hasSearch ? 'No matching records' : 'No sales yet'}
      </Text>
      <Text style={styles.emptyHint}>
        {hasSearch
          ? 'Try a different customer or product name.'
          : 'Sales recorded via "Record Sale" will appear here.'}
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

  // ── Filter ───────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q
    ? allGroups.filter(
        (g) =>
          g.customerOrSource?.toLowerCase().includes(q) ||
          g.items.some((tx) => tx.productName?.toLowerCase().includes(q)),
      )
    : allGroups;

  // ── Group by date for headers ─────────────
  const dateMap = {};
  filtered.forEach((g) => {
    const dateKey = g.timestamp ? g.timestamp.slice(0, 11).trim() : 'Unknown Date';
    if (!dateMap[dateKey]) dateMap[dateKey] = [];
    dateMap[dateKey].push(g);
  });

  const listItems = [];
  Object.entries(dateMap).forEach(([date, groups]) => {
    listItems.push({ type: 'header', date, count: groups.length, key: `h-${date}` });
    groups.forEach((g) => listItems.push({ type: 'card', group: g, key: g.key }));
  });

  // ── Totals ───────────────────────────────
  const totalUnits = filtered.reduce(
    (s, g) => s + g.items.reduce((si, t) => si + (t.quantity || 0), 0),
    0,
  );
  const totalRecords = filtered.length;

  const handleEditGroup = (group) => {
    navigation.navigate(ROUTES.EDIT_SALE, { group });
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <DateHeader date={item.date} count={item.count} />;
    }
    return (
      <SaleCard
        group={item.group}
        onEdit={() => handleEditGroup(item.group)}
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

      {/* ── Summary strip ────────────────── */}
      {!loading && allGroups.length > 0 && (
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryText}>
            {totalRecords} sale{totalRecords !== 1 ? 's' : ''}
            {q ? ` matching "${search}"` : ''}
          </Text>
          <Text style={styles.summaryDot}>·</Text>
          <Text style={styles.summaryTotal}>{totalUnits} units sold</Text>
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
          ListEmptyComponent={<EmptyState hasSearch={!!q} />}
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 12, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  clearBtn:    { fontSize: 14, color: COLORS.textSecondary, paddingLeft: 4 },

  // ── Summary ───────────────────────────────
  summaryStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 6, gap: 6,
  },
  summaryText:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryDot:   { color: COLORS.textSecondary, fontSize: 12 },
  summaryTotal: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  // ── Date header ───────────────────────────
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.background,
  },
  dateHeaderText: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  dateHeaderBadge: {
    backgroundColor: '#E8EEF8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  dateHeaderBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },

  // ── Sale card ─────────────────────────────
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#E8EEF8', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },

  headerMid:    { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 3 },
  headerTime:   { fontSize: 11, color: COLORS.textSecondary },

  headerRight: { alignItems: 'flex-end' },
  totalLabel:  { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  totalUnits:  { fontSize: 24, fontWeight: '800', color: COLORS.primary, lineHeight: 28 },
  totalSub:    { fontSize: 9, color: COLORS.textSecondary, fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 14 },

  productRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  productRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  productIcon:      { fontSize: 15 },
  productName:      { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, lineHeight: 18 },
  productRight:     { alignItems: 'flex-end', minWidth: 48 },
  productQty:       { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 22 },
  productQtyLabel:  { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },

  // ── Edit sale button ──────────────────────
  editSaleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 14, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: '#E8EEF8', gap: 8,
  },
  editSaleIcon:    { fontSize: 14 },
  editSaleText:    { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  editSaleChevron: { fontSize: 20, color: COLORS.primary, lineHeight: 22 },

  // ── Loading / Empty ───────────────────────
  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },

  emptyFlex: { flex: 1, justifyContent: 'center' },
  emptyBox:  { alignItems: 'center', padding: 32 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});