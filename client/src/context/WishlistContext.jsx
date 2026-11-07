import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { saveWishlist } from '../cloud.js';

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
  const { user, cloud } = useAuth() || {};
  const synced = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('wishlist', JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  // Signed in: combine this device's saved items with the account's, then keep the account up to date.
  useEffect(() => {
    if (!user) {
      if (synced.current) { synced.current = false; setItems([]); }
      return;
    }
    if (!cloud?.ready) return;
    setItems((cur) => {
      const have = new Set(cur.map((i) => i.id));
      return [...cur, ...(cloud.wishlist || []).filter((i) => i && i.id && !have.has(i.id))];
    });
    synced.current = true;
  }, [user, cloud?.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !synced.current) return undefined;
    const t = setTimeout(() => saveWishlist(user.uid, items).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [items, user]);

  const toggle = useCallback((item) => setItems((cur) => (cur.some((i) => i.id === item.id) ? cur.filter((i) => i.id !== item.id) : [item, ...cur])), []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const value = useMemo(
    () => ({ items, count: items.length, has: (id) => items.some((i) => i.id === id), toggle, remove }),
    [items, toggle, remove],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
