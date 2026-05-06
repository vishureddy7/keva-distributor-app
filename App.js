// ─────────────────────────────────────────────
//  App.js
// ─────────────────────────────────────────────

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';

import { NavigationContainer }                       from '@react-navigation/native';
import { createStackNavigator }                      from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme }   from 'react-native-paper';

import { AppProvider, useAppContext } from './src/context/AppContext';

// ── Screens ───────────────────────────────────
import HomeScreen           from './src/screens/HomeScreen';
import RecordSaleScreen     from './src/screens/RecordSaleScreen';
import RestockScreen        from './src/screens/RestockScreen';
import AddProductScreen     from './src/screens/AddProductScreen';
import ViewStockScreen      from './src/screens/ViewStockScreen';
import ExcelViewScreen      from './src/screens/ExcelViewScreen';
import EditProductScreen    from './src/screens/EditProductScreen';
import CustomerSalesScreen  from './src/screens/CustomerSalesScreen';
import EditSaleScreen       from './src/screens/EditSaleScreen';
import ProductDetailScreen  from './src/screens/ProductDetailScreen';

import { ROUTES, COLORS } from './src/utils/constants';

const Stack = createStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary:    COLORS.primary,
    accent:     COLORS.accent,
    background: COLORS.background,
    surface:    COLORS.surface,
    text:       COLORS.textPrimary,
    error:      COLORS.error,
  },
};

const defaultScreenOptions = {
  headerStyle: {
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowOpacity: 0.3,
  },
  headerTintColor:   COLORS.surface,
  headerTitleStyle:  { fontWeight: '700', fontSize: 18, letterSpacing: 0.3 },
  cardStyle:         { backgroundColor: COLORS.background },
};

// ─────────────────────────────────────────────
//  Loading / Error gate
// ─────────────────────────────────────────────

function AppGate({ children }) {
  const { loading, initError } = useAppContext();

  if (initError) {
    return (
      <View style={styles.centred}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Startup Failed</Text>
        <Text style={styles.errorMsg}>{initError}</Text>
        <Text style={styles.errorHint}>
          Please close and reopen the app. If the problem persists, reinstall.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Keva Distributor…</Text>
      </View>
    );
  }

  return children;
}

// ─────────────────────────────────────────────
//  Navigator
// ─────────────────────────────────────────────

function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={ROUTES.HOME}
        screenOptions={defaultScreenOptions}
      >
        <Stack.Screen
          name={ROUTES.HOME}
          component={HomeScreen}
          options={{ title: 'Keva Distributor', headerLeft: () => null }}
        />
        <Stack.Screen
          name={ROUTES.RECORD_SALE}
          component={RecordSaleScreen}
          options={{ title: 'Record Sale' }}
        />
        <Stack.Screen
          name={ROUTES.RESTOCK}
          component={RestockScreen}
          options={{ title: 'Add Stock' }}
        />
        <Stack.Screen
          name={ROUTES.ADD_PRODUCT}
          component={AddProductScreen}
          options={{ title: 'Add New Product' }}
        />
        <Stack.Screen
          name={ROUTES.VIEW_STOCK}
          component={ViewStockScreen}
          options={{ title: 'Current Stock' }}
        />
        <Stack.Screen
          name={ROUTES.EXCEL_VIEW}
          component={ExcelViewScreen}
          options={{ title: 'View / Export Excel' }}
        />
        <Stack.Screen
          name={ROUTES.EDIT_PRODUCT}
          component={EditProductScreen}
          options={{ title: 'Edit Product' }}
        />
        <Stack.Screen
          name={ROUTES.CUSTOMER_SALES}
          component={CustomerSalesScreen}
          options={{ title: 'Customer Sales Records' }}
        />
        <Stack.Screen
          name={ROUTES.EDIT_SALE}
          component={EditSaleScreen}
          options={{ title: 'Edit Sale' }}
        />
        <Stack.Screen
          name={ROUTES.PRODUCT_DETAIL}
          component={ProductDetailScreen}
          options={({ route }) => ({
            title: route.params?.product?.productName ?? 'Product Detail',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AppProvider>
        <AppGate>
          <AppNavigator />
        </AppGate>
      </AppProvider>
      <StatusBar style="light" backgroundColor={COLORS.primaryDark} />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  errorIcon:  { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: COLORS.error, marginBottom: 8 },
  errorMsg:   { fontSize: 14, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  errorHint:  { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', fontStyle: 'italic' },
});