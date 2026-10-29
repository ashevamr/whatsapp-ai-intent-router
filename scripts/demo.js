// Runs a few sample WhatsApp messages through the pipeline and prints each decision.
// Works offline; set OPENAI_API_KEY to use an LLM for classification and replies.

import { handleMessage } from '../src/pipeline.js';
import { llmEnabled } from '../src/llm.js';

const samples = [
  { from: '77010000001', text: 'Здравствуйте, сколько стоит фильтр под мойку? Есть рассрочка?' },
  { from: '77010000001', text: 'Хорошо, когда можете установить?' },
  { from: '77010000002', text: 'Фильтр течёт под раковиной, что делать?' },
  { from: '77010000003', text: 'Это ужас, второй раз ломается, верните деньги!' },
  { from: '77010000004', text: 'How much is the reverse osmosis system?' },
];

console.log(`Mode: ${llmEnabled() ? 'LLM (OpenAI-compatible API)' : 'offline (rules + templates)'}\n`);

for (const msg of samples) {
  const r = await handleMessage(msg);
  console.log('─'.repeat(60));
  console.log(`📩 ${msg.from}: ${msg.text}`);
  console.log('🧠 decision:', JSON.stringify(r.classification));
  console.log(`📊 lead score: ${r.customer.leadScore} · stage: ${r.customer.stage}`);
  console.log(`💬 reply (${r.replySource}${r.handover ? ', HANDOVER to manager' : ''}):\n${r.reply}`);
}
