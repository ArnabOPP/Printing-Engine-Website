import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Lock, User, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { authMessage } from '../firebase.js';

// One page for signing in, creating an account and resetting a password.
export default function Login() {
  const { user, loading, available, signIn, signUp, google, reset } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const back = loc.state?.from || '/account';
  const [mode, setMode] = useState(loc.pathname === '/signup' ? 'signup' : 'signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  if (user && !loading) return <Navigate to={back} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchTo = (m) => { setMode(m); setError(''); setNote(''); };

  const run = async (job) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await job();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return; }
    if (mode === 'reset') {
      run(async () => { await reset(form.email); setNote('If an account exists for this email, a reset link is on its way. Check your inbox and spam.'); });
      return;
    }
    if (mode === 'signup' && form.name.trim().length < 2) { setError('Enter your name.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    run(async () => {
      if (mode === 'signup') await signUp(form.name, form.email, form.password);
      else await signIn(form.email, form.password);
      nav(back, { replace: true });
    });
  };

  const title = mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';

  return (
    <div className="wrap au">
      <div className="au-card">
        <h1>{title}</h1>
        <p className="co-lead">
          {mode === 'signup' ? 'Save your details and track your orders.' : mode === 'reset' ? 'We will email you a link to choose a new password.' : 'Sign in to see your account and orders.'}
        </p>

        {!available ? (
          <p className="au-error" role="alert">Sign-in is not switched on yet. Add the Firebase settings to the website (see <code>client/.env.example</code>) and rebuild.</p>
        ) : (
          <>
            {mode !== 'reset' && (
              <>
                <button type="button" className="au-google" disabled={busy} onClick={() => run(async () => { await google(); nav(back, { replace: true }); })}>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
                  Continue with Google
                </button>
                <div className="au-or"><span>or use your email</span></div>
              </>
            )}

            <form onSubmit={submit} noValidate className="au-form">
              {mode === 'signup' && (
                <label className="co-field"><span>Full name</span>
                  <div className="au-input"><User size={16} /><input type="text" autoComplete="name" value={form.name} onChange={set('name')} /></div>
                </label>
              )}
              <label className="co-field"><span>Email</span>
                <div className="au-input"><Mail size={16} /><input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" /></div>
              </label>
              {mode !== 'reset' && (
                <label className="co-field"><span>Password</span>
                  <div className="au-input">
                    <Lock size={16} />
                    <input type={show ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
                    <button type="button" className="au-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
              )}

              {error && <p className="au-error" role="alert">{error}</p>}
              {note && <p className="au-note" role="status">{note}</p>}

              <button type="submit" className="btn btn-lime-solid au-submit" disabled={busy || loading}>
                {mode === 'signup' ? <><UserPlus size={16} /> Create account</> : mode === 'reset' ? 'Send reset link' : <><LogIn size={16} /> Sign in</>}
              </button>
            </form>

            <div className="au-links">
              {mode === 'signin' && <button type="button" onClick={() => switchTo('reset')}>Forgot password?</button>}
              {mode === 'signin' && <span>New here? <button type="button" onClick={() => switchTo('signup')}>Create an account</button></span>}
              {mode !== 'signin' && <span>Already have an account? <button type="button" onClick={() => switchTo('signin')}>Sign in</button></span>}
            </div>
          </>
        )}
        <p className="au-guest">You can also <Link to="/print-on-demand">keep shopping</Link> without an account. Checkout works for guests.</p>
      </div>
    </div>
  );
}
