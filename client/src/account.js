// The customer's saved details and past orders. There is no sign-in or server yet, so both live in this browser only.

export const EMPTY_ACCOUNT = { name: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pin: '' };

export function readAccount() {
  try {
    const a = JSON.parse(localStorage.getItem('account') || 'null');
    return a && typeof a === 'object' ? { ...EMPTY_ACCOUNT, ...a } : { ...EMPTY_ACCOUNT };
  } catch {
    return { ...EMPTY_ACCOUNT };
  }
}

export function writeAccount(account) {
  try { localStorage.setItem('account', JSON.stringify(account)); } catch { /* ignore */ }
}

export function readOrders() {
  try {
    const o = JSON.parse(localStorage.getItem('orders') || '[]');
    return Array.isArray(o) ? o : [];
  } catch {
    return [];
  }
}

// Same checks the checkout uses. Returns an error message per invalid field.
export function validateDetails(f, { optional = false } = {}) {
  const e = {};
  const filled = (v) => String(v || '').trim() !== '';
  const check = (key, ok, msg) => { if (optional && !filled(f[key])) return; if (!ok) e[key] = msg; };
  check('name', f.name.trim().length >= 2, 'Enter your full name.');
  check('phone', /^[6-9]\d{9}$/.test(f.phone.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')), 'Enter a 10 digit Indian mobile number.');
  check('email', /^\S+@\S+\.\S+$/.test(f.email.trim()), 'Enter a valid email address.');
  check('line1', f.line1.trim().length >= 5, 'Enter your house number and street.');
  check('city', f.city.trim().length >= 2, 'Enter your city.');
  check('state', f.state.trim().length >= 2, 'Enter your state.');
  check('pin', /^[1-9]\d{5}$/.test(f.pin.trim()), 'Enter a 6 digit PIN code.');
  return e;
}
