// ─────────────────────────────────────────────
//  AppContext.js
//  Global state — now powered by Firestore.
//  Products update in real-time on ALL devices.
// ─────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import { subscribeToProducts } from '../services/firebaseService';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    let unsub;
    try {
      unsub = subscribeToProducts((updatedProducts) => {
        setProducts(updatedProducts);
        setLoading(false);
      });
    } catch (err) {
      setInitError(err.message || 'Failed to connect to database.');
      setLoading(false);
    }
    return () => { if (unsub) unsub(); };
  }, []);

  const refreshProducts = useCallback(() => {}, []);

  const getStockFor = useCallback(
    (productName) => {
      const p = products.find(
        (x) => x.productName.toLowerCase() === productName.toLowerCase(),
      );
      return p ? p.currentStock : 0;
    },
    [products],
  );

  const productNames = products.map((p) => p.productName);

  return (
    <AppContext.Provider value={{ products, productNames, loading, initError, refreshProducts, getStockFor }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}
