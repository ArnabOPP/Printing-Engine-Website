import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { printProducts } from '../printProducts.js';
import NotFound from './NotFound.jsx';

// Placeholder for the design studio. The product picker links here.
export default function Customise() {
  const { slug } = useParams();
  const product = printProducts.find((p) => p.slug === slug);
  if (!product) return <NotFound />;

  return (
    <section className="page">
      <Link to="/print-on-demand" className="link"><ArrowLeft size={14} /> Change product</Link>
      <h1>{product.name}{product.spec ? ` — ${product.spec}` : ''}</h1>
      <p>{product.category}. The design studio for this product is the next step and isn’t built yet.</p>
    </section>
  );
}
