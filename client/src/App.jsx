import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Product from './pages/Product.jsx';
import PrintOnDemand from './pages/PrintOnDemand.jsx';
import Customise from './pages/Customise.jsx';
import Design from './pages/Design.jsx';
import Checkout from './pages/Checkout.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Account from './pages/Account.jsx';

// The admin panel is loaded only when someone opens /admin, so it stays out of the shop's main download.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="product/:slug" element={<Product />} />
        <Route path="print-on-demand" element={<PrintOnDemand />} />
        <Route path="customise/:slug" element={<Customise />} />
        <Route path="design/:slug" element={<Design />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
