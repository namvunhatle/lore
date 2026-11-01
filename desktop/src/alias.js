// PRV-07: a fresh email alias for a sign-up, made with the person's own account at an alias service (Addy.io or SimpleLogin).
// Lore runs no mail relay: it only asks the service for an alias. The service sees the request; Lore sends only the site name
// as a note so the alias can be found again.
const SERVICES = {
  addy: { name: 'Addy.io' },
  simplelogin: { name: 'SimpleLogin' }
};
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

async function create({ provider, key, note = '', fetchImpl = fetch }) {
  if (!SERVICES[provider]) throw new Error('alias.off');
  if (!key) throw new Error('alias.key');
  const text = String(note).replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 100);
  let r;
  if (provider === 'addy') {
    r = await fetchImpl('https://app.addy.io/api/v1/aliases', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ domain: 'anonaddy.me', format: 'random_characters', description: text }),
      signal: AbortSignal.timeout(15000)
    });
  } else {
    r = await fetchImpl('https://app.simplelogin.io/api/alias/random/new?mode=uuid', {
      method: 'POST',
      headers: { Authentication: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: text }),
      signal: AbortSignal.timeout(15000)
    });
  }
  if (r.status === 401 || r.status === 403) throw new Error('alias.key');
  if (!r.ok) throw new Error('alias.http');
  const j = await r.json();
  const email = provider === 'addy' ? j && j.data && j.data.email : j && j.alias;
  if (typeof email !== 'string' || !EMAIL.test(email)) throw new Error('alias.http');
  return email;
}

module.exports = { create, SERVICES };
