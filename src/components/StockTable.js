// ─────────────────────────────────────────────
//  StockTable.js  (UPDATED)
//  Fixes: bigger font, product name wraps to 2 lines, onRowPress support
// ─────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { COLORS, LOW_STOCK_THRESHOLD } from '../utils/constants';

// ─────────────────────────────────────────────
//  Column definitions
// ─────────────────────────────────────────────

const FULL_COLUMNS = [
  { key: 'productName',  label: 'Product',   flex: 3.2, align: 'left'  },
  { key: 'totalStockIn', label: 'Stock In',  flex: 1,   align: 'right' },
  { key: 'totalSold',    label: 'Sold',      flex: 0.8, align: 'right' },
  { key: 'currentStock', label: 'Available', flex: 1,   align: 'right' },
];

const COMPACT_COLUMNS = [
  { key: 'productName',  label: 'Product',       flex: 2,   align: 'left'  },
  { key: 'currentStock', label: 'Available',      flex: 1,   align: 'right' },
];

// ─────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────

function HeaderCell({ column }) {
  return (
    <View style={[styles.cell, { flex: column.flex }]}>
      <Text
        style={[styles.headerText, column.align === 'right' && styles.textRight]}
        numberOfLines={1}
      >
        {column.label}
      </Text>
    </View>
  );
}

function DataCell({ column, value, isLowStock }) {
  const isStock   = column.key === 'currentStock';
  const isName    = column.key === 'productName';
  // Allow product name and lastUpdated to wrap to 2 lines
  const numLines  = isName || column.key === 'lastUpdated' ? 2 : 1;

  return (
    <View style={[styles.cell, { flex: column.flex }]}>
      <Text
        style={[
          styles.cellText,
          isName  && styles.cellTextName,
          column.align === 'right' && styles.textRight,
          isStock && isLowStock && styles.lowStockText,
          isStock && isLowStock && styles.lowStockValue,
        ]}
        numberOfLines={numLines}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

function ProductRow({ product, columns, isEven, onPress }) {
  const isLowStock   = product.currentStock <= LOW_STOCK_THRESHOLD;
  const isOutOfStock = product.currentStock === 0;

  const rowContent = (
    <>
      {columns.map((col) => (
        <DataCell
          key={col.key}
          column={col}
          value={product[col.key]}
          isLowStock={isLowStock}
        />
      ))}
      {isLowStock && (
        <View style={[
          styles.stockIndicator,
          isOutOfStock ? styles.indicatorEmpty : styles.indicatorLow,
        ]} />
      )}
      {/* Edit hint chevron when onPress is provided */}
      {!!onPress && (
        <Text style={styles.editChevron}>›</Text>
      )}
    </>
  );

  const rowStyle = [
    styles.row,
    isEven         && styles.rowEven,
    isOutOfStock   && styles.rowOutOfStock,
    isLowStock && !isOutOfStock && styles.rowLowStock,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={rowStyle} onPress={() => onPress(product)} activeOpacity={0.7}>
        {rowContent}
      </TouchableOpacity>
    );
  }

  return <View style={rowStyle}>{rowContent}</View>;
}

function SkeletonRow({ columns, isEven }) {
  return (
    <View style={[styles.row, isEven && styles.rowEven]}>
      {columns.map((col) => (
        <View key={col.key} style={[styles.cell, { flex: col.flex }]}>
          <View style={[
            styles.skeleton,
            col.align === 'right' && styles.skeletonRight,
            col.key === 'productName' && styles.skeletonWide,
          ]} />
        </View>
      ))}
    </View>
  );
}

function EmptyState({ compact }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>No products yet</Text>
      <Text style={styles.emptyHint}>
        {compact
          ? 'Add your first product to get started.'
          : 'Go to "Add New Product" to create your first entry.'}
      </Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.indicatorLow]} />
        <Text style={styles.legendText}>Low stock (≤ {LOW_STOCK_THRESHOLD})</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.indicatorEmpty]} />
        <Text style={styles.legendText}>Out of stock</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────

export default function StockTable({
  products   = [],
  loading    = false,
  compact    = false,
  onRefresh,
  refreshing = false,
  onRowPress,          // NEW: (product) => void — makes rows tappable
}) {
  const columns = compact ? COMPACT_COLUMNS : FULL_COLUMNS;

  return (
    <View style={styles.wrapper}>

      {/* ── Summary bar ───────────────────── */}
      {!loading && products.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {products.length} product{products.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.summaryDot}>·</Text>
          <Text style={[styles.summaryText, styles.summaryLow]}>
            {products.filter(p => p.currentStock <= LOW_STOCK_THRESHOLD && p.currentStock > 0).length} low stock
          </Text>
          <Text style={styles.summaryDot}>·</Text>
          <Text style={[styles.summaryText, styles.summaryOut]}>
            {products.filter(p => p.currentStock === 0).length} out of stock
          </Text>
          {!!onRowPress && (
            <Text style={[styles.summaryText, styles.summaryEdit]}>
              · tap row to edit
            </Text>
          )}
        </View>
      )}

      {/* ── Table ─────────────────────────── */}
      <View style={styles.tableWrapper}>
        <View style={styles.header}>
          {columns.map((col) => (
            <HeaderCell key={col.key} column={col} />
          ))}
        </View>

        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            ) : undefined
          }
        >
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columns={columns} isEven={i % 2 === 0} />
            ))
          ) : products.length === 0 ? (
            <EmptyState compact={compact} />
          ) : (
            products.map((product, index) => (
              <ProductRow
                key={product.productName}
                product={product}
                columns={columns}
                isEven={index % 2 === 0}
                onPress={onRowPress}
              />
            ))
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      </View>

      {/* ── Legend ────────────────────────── */}
      {!loading && products.length > 0 && !compact && <Legend />}
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const HEADER_HEIGHT = 40;

const styles = StyleSheet.create({
  wrapper: { flex: 1 },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  summaryText:   { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryDot:    { color: COLORS.textSecondary, fontSize: 12 },
  summaryLow:    { color: COLORS.warning, fontWeight: '700' },
  summaryOut:    { color: COLORS.error, fontWeight: '700' },
  summaryEdit:   { color: COLORS.primary, fontWeight: '500', fontStyle: 'italic' },

  tableWrapper: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  header: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    height: HEADER_HEIGHT,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.surface,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  body: { flex: 1 },

  row: {
    flexDirection: 'row',
    minHeight: 52,          // increased from 48 to accommodate 2-line product names
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
    overflow: 'hidden',
  },
  rowEven:       { backgroundColor: '#FAFBFF' },
  rowLowStock:   { backgroundColor: COLORS.lowStock },
  rowOutOfStock: { backgroundColor: '#FFF3F3' },

  cell: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,           // increased from 13
    color: COLORS.textPrimary,
  },
  cellTextName: {
    fontSize: 13,           // product names slightly smaller to fit, but still readable
    fontWeight: '500',
    lineHeight: 18,
  },
  textRight: { textAlign: 'right' },

  lowStockText:  { fontWeight: '700' },
  lowStockValue: { color: COLORS.lowStockText },

  stockIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  indicatorLow:   { backgroundColor: COLORS.warning },
  indicatorEmpty: { backgroundColor: COLORS.error },

  // Edit chevron
  editChevron: {
    fontSize: 20,
    color: COLORS.textSecondary,
    paddingRight: 6,
    lineHeight: 24,
  },

  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    width: '60%',
  },
  skeletonRight: { alignSelf: 'flex-end', width: '80%' },
  skeletonWide:  { width: '85%' },

  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.textSecondary },
});