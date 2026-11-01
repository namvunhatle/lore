// PRV-08: has this password appeared in a known data breach? Uses the Pwned Passwords range service with k-anonymity: the
// password is hashed here (SHA-1) and only the first 5 characters of the hash are sent; the service answers with every hash
// that starts the same way and the match is looked for on this computer. The password itself never leaves.
const crypto = require('crypto');

async function timesSeen(password, fetchImpl = fetch) {
  if (!password) throw new Error('breach.empty');
  const hash = crypto.createHash('sha1').update(String(password), 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const r = await fetchImpl('https://api.pwnedpasswords.com/range/' + prefix, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('breach.http');
  for (const line of (await r.text()).split(/\r?\n/)) {
    const [s, n] = line.trim().split(':');
    if (s === suffix) return Number(n) || 0;
  }
  return 0;
}

module.exports = { timesSeen };
