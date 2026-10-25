import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Product from './pages/Product.jsx';
import PrintOnDemand from './pages/PrintOnDemand.jsx';
import Customise from './pages/Customise.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="product/:slug" element={<Product />} />
        <Route path="print-on-demand" element={<PrintOnDemand />} />
        <Route path="customise/:slug" element={<Customise />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
