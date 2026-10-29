// WhatsApp Cloud API helpers: signature check, webhook parsing, sending text.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

// Meta signs every webhook body with the app secret (header X-Hub-Signature-256).
export function verifySignature(rawBody, signatureHeader, appSecret = config.appSecret) {
  if (!appSecret) return true; // local development without a secret
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = signatureHeader.slice('sha256='.length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

// Extracts plain text messages from a Cloud API webhook payload.
export function parseWebhook(body) {
  const messages = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const m of change.value?.messages || []) {
        if (m.type === 'text' && m.text?.body) {
          messages.push({ id: m.id, from: m.from, text: m.text.body });
        }
      }
    }
  }
  return messages;
}

export async function sendText(to, text) {
  if (!config.whatsappToken || !config.whatsappPhoneNumberId) {
    console.log(`[dry-run] -> ${to}: ${text}`);
    return { dryRun: true };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.whatsappToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status}`);
  return res.json();
}
