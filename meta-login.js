const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const META_CLIENT_ID = '1031625952748946';
const DEVICE_AUTH_URL = 'https://auth.meta.com/oidc/device/authorization/';
const DEVICE_TOKEN_URL = 'https://auth.meta.com/oidc/device/token/';
const MINT_URL = 'https://api.meta.ai/muse-code/key';
function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postBody = typeof data === 'string' ? data : new URLSearchParams(data).toString();
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'curl/8.4.0',
        'Content-Length': Buffer.byteLength(postBody),
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}
async function login() {
  console.log('Requesting device authorization code from Meta...');
  const authRes = await post(DEVICE_AUTH_URL, { client_id: META_CLIENT_ID });
  if (authRes.status !== 200 || !authRes.data.user_code) {
    console.error('Failed to start device auth:', authRes.data);
    return;
  }
  const { user_code, verification_uri_complete, device_code, interval = 5, expires_in = 600 } = authRes.data;
  const authUrl = verification_uri_complete || ('https://auth.meta.com/oauth/device/?code=' + user_code);
  console.log('\n-----------------------------------------------------');
  console.log('  1. Your One-Time Code : ' + user_code);
  console.log('  2. Verification URL   : ' + authUrl);
  console.log('-----------------------------------------------------\n');
  // Auto-opens user browser
  exec('start "" "' + authUrl + '"');
  console.log('Log into your Meta account with your subscription email in the browser...');
  const deadline = Date.now() + expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval * 1000));
    const tokenRes = await post(DEVICE_TOKEN_URL, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code,
      client_id: META_CLIENT_ID
    });
if (tokenRes.status === 200 && tokenRes.data.access_token) {
  console.log('\nLogin approved! Minting monthly subscription key...');

  const mintRes = await post(MINT_URL, '{}', {
    'Authorization': 'Bearer ' + tokenRes.data.access_token,
    'Content-Type': 'application/json',
    'x-api-version': '1.0.0'
  });

  const finalKey = (mintRes.status === 200 && mintRes.data?.api_key)
    ? mintRes.data.api_key
    : tokenRes.data.access_token;

  console.log('\n=====================================================');
  console.log('Your Minted Subscription Key:');
  console.log(finalKey);
  console.log('=====================================================\n');
  return;
}

if (tokenRes.data?.error === 'authorization_pending') {
  process.stdout.write('.');
  continue;
}
  }
}
login();