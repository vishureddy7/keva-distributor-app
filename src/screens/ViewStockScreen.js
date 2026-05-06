// ─────────────────────────────────────────────
//  ViewStockScreen.js
//  Tap any product row → ProductDetailScreen
//  (shows customer purchase history + stock records + edit option)
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAppContext } from '../context/AppContext';
import StockTable        from '../components/StockTable';
import { COLORS, ROUTES } from '../utils/constants';

export default function ViewStockScreen({ navigation }) {
  const { products, loading, refreshProducts } = useAppContext();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshProducts();
    }, [refreshProducts]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProducts();
    setRefreshing(false);
  }, [refreshProducts]);

  // Navigate to ProductDetail so user can see purchases + stock history
  // ProductDetail already has an "Edit Product" button built in
  const handleRowPress = useCallback(
    (product) => navigation.navigate(ROUTES.PRODUCT_DETAIL, { product }),
    [navigation],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* ── Hint banner ──────────────────────── */}
      {!loading && products.length > 0 && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintIcon}>📋</Text>
          <Text style={styles.hintText}>
            Tap any row to view purchases, stock history &amp; edit options
          </Text>
        </View>
      )}

      <View style={styles.container}>
        <StockTable
          products={products}
          loading={loading && !refreshing}
          onRefresh={onRefresh}
          refreshing={refreshing}
          compact={false}
          onRowPress={handleRowPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D8DEFF',
  },
  hintIcon: { fontSize: 13 },
  hintText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  container: {
    flex: 1,
    paddingTop: 8,
  },
});