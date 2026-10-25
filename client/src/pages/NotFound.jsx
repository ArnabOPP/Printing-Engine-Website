import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="page">
      <h1>404</h1>
      <p>Page not found. <Link to="/">Back home</Link></p>
    </section>
  );
}
