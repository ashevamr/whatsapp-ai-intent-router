import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.OPENAI_API_KEY;
process.env.WHATSAPP_APP_SECRET = 's3cret';

const { server } = await import('../src/server.js');
let base;

before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const payload = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.1', from: '77010000009', type: 'text', text: { body: 'Сколько стоит фильтр под мойку?' } },
  ] } }] }],
});
const sign = (body, secret = 's3cret') => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

test('health check', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(await res.text(), 'ok');
});

test('webhook verification echoes the challenge only with the right token', async () => {
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=dev-verify-token&hub.challenge=12345`);
  assert.equal(await ok.text(), '12345');
  const bad = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345`);
  assert.equal(bad.status, 403);
});

test('signed POST is accepted, unsigned is rejected', async () => {
  const good = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'X-Hub-Signature-256': sign(payload) }, body: payload });
  assert.equal(good.status, 200);
  const bad = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'X-Hub-Signature-256': sign(payload, 'wrong') }, body: payload });
  assert.equal(bad.status, 401);
});
