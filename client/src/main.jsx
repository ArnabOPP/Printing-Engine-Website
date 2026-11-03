import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { api } from './api.js';
import { applyCatalog } from './printProducts.js';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import './index.css';
import './studio.css';
import './studio-sleeves.css';
import './studio-pricing.css';
import './size-chart.css';
import './nav-shop.css';
import './checkout.css';
import './wishlist-account.css';

// Load the shop's saved prices and visibility before showing anything, so the first page is already right.
// If the server is slow or away, the built-in defaults are used.
async function loadCatalog() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const c = await api('/api/catalog', { signal: ctl.signal });
    clearTimeout(t);
    applyCatalog(c);
  } catch { /* use the defaults */ }
}

loadCatalog().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <CartProvider>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </CartProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
