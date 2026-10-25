import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext({ count: 0, add: () => {} });

function readCount() {
  try {
    return Number(localStorage.getItem('cart-count')) || 0;
  } catch {
    return 0;
  }
}

export function CartProvider({ children }) {
  const [count, setCount] = useState(readCount);

  useEffect(() => {
    try { localStorage.setItem('cart-count', String(count)); } catch { /* ignore */ }
  }, [count]);

  const add = useCallback((qty = 1) => setCount((c) => c + qty), []);
  const value = useMemo(() => ({ count, add }), [count, add]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
