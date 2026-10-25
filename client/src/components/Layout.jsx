import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Search, User, Heart, ShoppingBag, Moon, Sun, ChevronDown, ArrowRight, Mail, Phone } from 'lucide-react';
import { siInstagram, siFacebook, siWhatsapp, siYoutube, siVisa, siMastercard } from 'simple-icons';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Printing Engine home">
      <img src="/logo.jpg" alt="Printing Engine" className="logo-img" width="56" height="56" />
    </Link>
  );
}

function BrandIcon({ icon, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={icon.title}>
      <path d={icon.path} />
    </svg>
  );
}

const Social = ({ icon }) => (
  <a href="#" className={`social social-${icon.slug}`} aria-label={icon.title}>
    <BrandIcon icon={icon} />
  </a>
);

export default function Layout() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-in">
          <span className="topbar-left"><span className="dot" />Your Ideas. Our Prints. Endless Possibilities.</span>
          <span className="topbar-right">
            <a href="#how">Track Order</a>
            <a href="#how">Help</a>
            <a href="#footer">Contact</a>
          </span>
        </div>
      </div>

      <header className="nav">
        <div className="wrap nav-in">
          <Logo />
          <nav className="nav-links" aria-label="Primary">
            <a href="#categories">Shop <ChevronDown size={12} /></a>
            <a href="#customiser">Customise</a>
            <a href="#originals">VA Originals</a>
            <a href="#bulk">Bulk Orders</a>
            <a href="#gifts">Gift Store</a>
          </nav>
          <form className="search" onSubmit={(e) => e.preventDefault()} role="search">
            <Search size={16} />
            <input type="search" placeholder="Search for products, designs..." aria-label="Search" />
          </form>
          <div className="nav-icons">
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-btn" aria-label="Account"><User size={20} /></button>
            <button className="icon-btn" aria-label="Wishlist"><Heart size={20} /></button>
            <button className="icon-btn cart" aria-label="Cart"><ShoppingBag size={20} /><b>0</b></button>
          </div>
        </div>
      </header>

      <main><Outlet /></main>

      <footer className="footer" id="footer">
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>Your Ideas. Our Prints.<br />Endless Possibilities.</p>
            <div className="socials">
              <Social icon={siInstagram} /><Social icon={siFacebook} /><Social icon={siWhatsapp} /><Social icon={siYoutube} />
            </div>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="#categories">All Products</a><a href="#categories">T-Shirts</a><a href="#categories">Mugs & Drinkware</a>
            <a href="#categories">Keychains & Accessories</a><a href="#categories">Stationery</a><a href="#categories">Stickers & Labels</a><a href="#categories">Photo Gifts</a>
          </div>
          <div>
            <h4>Help</h4>
            <a href="#how">FAQs</a><a href="#how">Size Guide</a><a href="#how">Artwork Guidelines</a><a href="#how">Shipping Policy</a>
            <a href="#how">Returns & Refunds</a><a href="#how">Track Order</a><a href="#footer">Contact Us</a>
          </div>
          <div>
            <h4>Company</h4>
            <NavLink to="/about">About Us</NavLink><a href="#originals">VA Originals</a><a href="#bulk">Bulk Orders</a>
            <a href="#bulk">Reseller Program</a><a href="#footer">Terms & Conditions</a><a href="#footer">Privacy Policy</a>
          </div>
          <div className="footer-join">
            <h4>Join Our Community</h4>
            <p>Get updates on new drops, offers and more.</p>
            <form className="join" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Your email address" aria-label="Email address" />
              <button aria-label="Subscribe"><ArrowRight size={18} /></button>
            </form>
            <div className="pay">
              <span className="pay-text">UPI</span>
              <BrandIcon icon={siVisa} className="pay-logo" />
              <BrandIcon icon={siMastercard} className="pay-logo" />
              <span className="pay-text">RuPay</span>
            </div>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>&copy; {new Date().getFullYear()} Printing Engine. All rights reserved.</span>
          <span className="contact-mini"><Mail size={13} /> hello@printingengine.example <Phone size={13} /> +91 00000 00000</span>
          <span>Made with <span className="heart">♥</span> for creators.</span>
        </div>
      </footer>
    </>
  );
}
