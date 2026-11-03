import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// A saved item: { id, name, price, img, href }. `price` is in rupees, or null when it is quoted at order.
const WishlistContext = createContext({ items: [], count: 0, has: () => false, toggle: () => {}, remove: () => {} });

function read() {
  try {
    const items = JSON.parse(localStorage.getItem('wishlist') || '[]');
    return Array.isArray(items) ? items.filter((i) => i && i.id) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(read);

  useEffect(() => {
    try { localStorage.setItem('wishlist', JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const toggle = useCallback((item) => setItems((cur) => (cur.some((i) => i.id === item.id) ? cur.filter((i) => i.id !== item.id) : [item, ...cur])), []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const value = useMemo(
    () => ({ items, count: items.length, has: (id) => items.some((i) => i.id === id), toggle, remove }),
    [items, toggle, remove],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
