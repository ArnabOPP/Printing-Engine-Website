import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// A cart line: { id, name, detail, img, qty, unit, slug, config }
//   slug/config: set for custom designs (the product and the options chosen), so the order can include the artwork.
//   unit: price of one piece in rupees, or null when the price is confirmed after the order (no estimate yet).
const CartContext = createContext({ count: 0, items: [], add: () => {}, setQty: () => {}, remove: () => {}, clear: () => {} });

function readItems() {
  try {
    const items = JSON.parse(localStorage.getItem('cart-items') || '[]');
    return Array.isArray(items) ? items.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function CartProvider({ children }) {
  const [items, setItems] = useState(readItems);

  useEffect(() => {
    try { localStorage.setItem('cart-items', JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  // Adding the same product with the same details again just raises its quantity.
  const add = useCallback((item) => {
    const qty = Math.max(1, Math.round(item.qty) || 1);
    setItems((cur) => {
      const key = item.key || `${item.name}|${item.detail}|${item.unit}`;
      const hit = !item.unique && cur.find((i) => i.key === key);
      if (hit) return cur.map((i) => (i === hit ? { ...i, qty: i.qty + qty } : i));
      return [...cur, { id: uid(), key, name: item.name, detail: item.detail || '', img: item.img || '', qty, unit: item.unit ?? null, slug: item.slug || '', config: item.config || null, designId: item.designId || '' }];
    });
  }, []);

  const setQty = useCallback((id, qty) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.round(qty) || 1) } : i))), []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.reduce((n, i) => n + i.qty, 0), add, setQty, remove, clear }),
    [items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
