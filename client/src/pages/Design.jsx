import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { printProducts } from '../printProducts.js';

// Placeholder for the design studio (step 3). It shows what was chosen on the options page.
export default function Design() {
  const { slug } = useParams();
  const { state } = useLocation();
  const product = printProducts.find((p) => p.slug === slug);

  if (!product || !state) return <Navigate to={product ? `/customise/${slug}` : '/print-on-demand'} replace />;

  const rows = [
    ['Product', state.product],
    state.material && ['Material', state.material],
    state.colour && ['Colour', state.colour],
    state.audience && ['For', state.audience],
    state.audience && ['Sizes', Object.entries(state.sizes).map(([s, n]) => `${s} × ${n}`).join(', ')],
    ['Total', `${state.quantity} ${state.quantity === 1 ? 'piece' : 'pieces'}`],
  ].filter(Boolean);

  return (
    <section className="page">
      <Link to={`/customise/${slug}`} className="link"><ArrowLeft size={14} /> Back to options</Link>
      <h1>Add your design</h1>
      <p>The design studio is the next step and isn’t built yet. This is what you chose:</p>
      <dl className="opt-recap">
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
    </section>
  );
}
