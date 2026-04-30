// ─────────────────────────────────────────────
//  ViewStockScreen.js  (UPDATED)
//  Tap any product row to open EditProductScreen.
// ─────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
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
    }, [refreshProducts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProducts();
    setRefreshing(false);
  }, [refreshProducts]);

  // Navigate to edit screen with full product object
  const handleRowPress = useCallback((product) => {
    navigation.navigate(ROUTES.EDIT_PRODUCT, { product });
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* ── Edit hint banner ─────────────── */}
      {!loading && products.length > 0 && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintIcon}>✏️</Text>
          <Text style={styles.hintText}>Tap any row to rename a product</Text>
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