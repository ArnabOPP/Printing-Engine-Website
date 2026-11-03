// Creates the first admin (the owner), or resets the owner's password.
//
//   npm run admin:create -w server
//
// It asks for an email, name and password. For scripted setups, set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD instead.
// The password is never written anywhere except as a one-way hash in the database file.
import readline from 'node:readline';
import { hashPassword, passwordProblem } from '../src/auth.js';
import { audit, data, newId, save } from '../src/store.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// Reads a password without showing it on screen.
function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const out = rl.output;
    rl.output = { write: () => true };
    rl.question('', (a) => { rl.output = out; process.stdout.write('\n'); resolve(a); });
  });
}

const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).trim().toLowerCase();
const name = (process.env.ADMIN_NAME || (await ask('Your name: '))).trim();
const password = process.env.ADMIN_PASSWORD || (await askHidden('Password (10+ characters, letters and a number): '));
rl.close();

if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2) { console.error('Enter a valid email and a name.'); process.exit(1); }
const problem = passwordProblem(password);
if (problem) { console.error(problem); process.exit(1); }

const existing = data().admins.find((a) => a.email === email);
const passHash = await hashPassword(password);
if (existing) {
  existing.passHash = passHash;
  existing.disabled = false;
  existing.tokenVersion = (existing.tokenVersion || 0) + 1;
  audit('cli', 'admin.password.reset', email);
  console.log(`Password updated for ${email}.`);
} else {
  const hasOwner = data().admins.some((a) => a.role === 'owner');
  data().admins.push({ id: newId('a_'), email, name, role: hasOwner ? 'admin' : 'owner', passHash, disabled: false, tokenVersion: 0, createdAt: new Date().toISOString() });
  audit('cli', 'admin.created', email);
  console.log(`${hasOwner ? 'Admin' : 'Owner'} account created for ${email}.`);
}
await save();
