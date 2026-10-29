import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

delete process.env.OPENAI_API_KEY; // tests always run offline

const { ruleBasedClassify, validateClassification } = await import('../src/classify.js');
const { retrieveContext } = await import('../src/context.js');
const { checkAmounts, templateReply } = await import('../src/reply.js');
const { verifySignature, parseWebhook } = await import('../src/whatsapp.js');
const { handleMessage } = await import('../src/pipeline.js');
const { resetMemory } = await import('../src/memory.js');

beforeEach(() => resetMemory());

test('classifies sales, support, booking and complaint messages', () => {
  assert.equal(ruleBasedClassify('Сколько стоит фильтр?').intent, 'sales');
  assert.equal(ruleBasedClassify('Фильтр течёт, помогите').intent, 'support');
  assert.equal(ruleBasedClassify('Когда можете установить?').intent, 'booking');
  const complaint = ruleBasedClassify('Ужас, верните деньги');
  assert.equal(complaint.intent, 'complaint');
  assert.equal(complaint.needs_human, true);
  assert.equal(complaint.priority, 'high');
});

test('normalizes a malformed LLM classification instead of trusting it', () => {
  const c = validateClassification({ intent: 'discount_please', confidence: 7, topics: 'x' });
  assert.equal(c.intent, 'other');
  assert.equal(c.confidence, 1);
  assert.deepEqual(c.topics, []);
});

test('sales context contains only catalogue products', () => {
  const ctx = retrieveContext({ intent: 'sales' }, 'фильтр под мойку');
  assert.deepEqual(ctx.products.map((p) => p.id), ['flt-under-sink']);
});

test('guardrail rejects an amount that is not in the catalogue', () => {
  const ctx = retrieveContext({ intent: 'sales' }, 'фильтр под мойку');
  assert.equal(checkAmounts('Стоит 89 000 ₸, рассрочка по 14 834 ₸', ctx).ok, true);
  const bad = checkAmounts('Для вас скидка: всего 59 000 ₸!', ctx);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.invented, [59000]);
});

test('template replies pass their own guardrail', () => {
  const ctx = retrieveContext({ intent: 'sales' }, 'цена');
  const reply = templateReply({ intent: 'sales', needs_human: false }, ctx, 'цена');
  assert.equal(checkAmounts(reply, ctx).ok, true);
});

test('verifies the WhatsApp webhook signature', () => {
  const body = Buffer.from('{"hello":"world"}');
  const sig = 'sha256=' + createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.equal(verifySignature(body, sig, 's3cret'), true);
  assert.equal(verifySignature(body, sig, 'wrong'), false);
  assert.equal(verifySignature(body, undefined, 's3cret'), false);
});

test('parses text messages from a Cloud API payload', () => {
  const payload = {
    entry: [{ changes: [{ value: { messages: [
      { id: 'wamid.1', from: '7701', type: 'text', text: { body: 'Привет' } },
      { id: 'wamid.2', from: '7701', type: 'image' },
    ] } }] }],
  };
  assert.deepEqual(parseWebhook(payload), [{ id: 'wamid.1', from: '7701', text: 'Привет' }]);
});

test('end to end: buying signals raise the lead score and qualify the lead', async () => {
  await handleMessage({ from: '7701', text: 'Сколько стоит осмос?' });
  const r = await handleMessage({ from: '7701', text: 'Когда можете установить?' });
  assert.equal(r.classification.intent, 'booking');
  assert.equal(r.customer.stage, 'qualified_lead');
  assert.equal(r.handover, false);
});

test('end to end: complaints are handed to a manager', async () => {
  const r = await handleMessage({ from: '7702', text: 'Это ужас, верните деньги' });
  assert.equal(r.handover, true);
  assert.match(r.reply, /менеджеру/);
});
