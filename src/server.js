// Minimal webhook server for the WhatsApp Cloud API. No framework, no dependencies.

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { handleMessage } from './pipeline.js';
import { parseWebhook, sendText, verifySignature } from './whatsapp.js';

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }

  // Meta calls this once to verify the webhook URL.
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === config.verifyToken;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : 'forbidden');
    return;
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    const raw = await readBody(req);
    if (!verifySignature(raw, req.headers['x-hub-signature-256'])) {
      res.writeHead(401).end('bad signature');
      return;
    }
    // Acknowledge immediately; WhatsApp retries if the webhook is slow.
    res.writeHead(200).end('ok');

    for (const msg of parseWebhook(JSON.parse(raw.toString('utf8')))) {
      try {
        const result = await handleMessage(msg);
        console.log(JSON.stringify({ from: msg.from, intent: result.classification.intent, handover: result.handover }));
        await sendText(msg.from, result.reply);
      } catch (err) {
        console.error('failed to handle message', msg.id, err.message);
      }
    }
    return;
  }

  res.writeHead(404).end('not found');
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  server.listen(config.port, () => console.log(`Webhook listening on http://localhost:${config.port}/webhook`));
}
