// One-time Pinterest user-OAuth helper (ADR-0007 选品). The Trends API needs a USER-authorized token
// (ads:read on an ad account); app-only client_credentials 401s on /trends. This prints the auth URL,
// takes the `code` you get back, exchanges it for tokens, and prints the line to add to .env.local.
//
//   1. In the Pinterest app dashboard, register a Redirect URI (default below: https://localhost/).
//   2. npm run pinterest:auth   → open the printed URL (logged into the app's account) → Approve.
//   3. The browser lands on the redirect URI with ?code=... in the address bar. Copy that whole URL
//      (or just the code) and paste it here.
//   4. Add the printed PINTEREST_REFRESH_TOKEN to .env.local, set TREND_SOURCE=pinterest.

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createInterface } from 'node:readline/promises';

const APP_ID = process.env.PINTEREST_APP_ID ?? '';
const SECRET = process.env.PINTEREST_APP_SECRET ?? '';
const REDIRECT = process.env.PINTEREST_REDIRECT_URI ?? 'https://localhost/';
const SCOPE = 'ads:read,user_accounts:read,boards:read,pins:read';

if (!APP_ID || !SECRET) {
  console.error('Missing PINTEREST_APP_ID / PINTEREST_APP_SECRET in .env.local');
  process.exit(1);
}

function authUrl(): string {
  const q = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
  });
  return `https://www.pinterest.com/oauth/?${q.toString()}`;
}

function extractCode(pasted: string): string {
  const s = pasted.trim();
  const m = s.match(/[?&]code=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : s; // accept full redirect URL or bare code
}

async function main() {
  console.log('\n1) Redirect URI in use:', REDIRECT, '(must be registered in the Pinterest app)');
  console.log('2) Open this URL in a browser logged into the app account, then Approve:\n');
  console.log('   ' + authUrl() + '\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question('3) Paste the redirected URL (or the code): ');
  rl.close();
  const code = extractCode(pasted);
  if (!code) { console.error('No code found.'); process.exit(1); }

  const basic = Buffer.from(`${APP_ID}:${SECRET}`).toString('base64');
  const resp = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    console.error(`\n✗ token exchange failed (${resp.status}): ${body}`);
    process.exit(1);
  }
  const json = JSON.parse(body) as { access_token?: string; refresh_token?: string };
  console.log('\n✅ Success. Add to .env.local:\n');
  if (json.refresh_token) console.log(`PINTEREST_REFRESH_TOKEN=${json.refresh_token}`);
  else if (json.access_token) console.log(`PINTEREST_ACCESS_TOKEN=${json.access_token}`);
  console.log('TREND_SOURCE=pinterest');
  console.log(`PINTEREST_REGION=${process.env.PINTEREST_REGION ?? 'KR'}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
