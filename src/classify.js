// Decision layer: turns a free-text message into a small, structured classification.
// The rest of the pipeline branches on this object, never on raw LLM prose.

import { chat, llmEnabled } from './llm.js';

export const INTENTS = ['sales', 'support', 'booking', 'complaint', 'other'];
export const PRIORITIES = ['low', 'medium', 'high'];
export const STAGES = ['new_lead', 'qualified_lead', 'existing_customer'];

const RULES = {
  complaint: ['жалоб', 'ужас', 'верните', 'возврат', 'обман', 'refund', 'terrible', 'complain', 'не довол'],
  booking: ['запис', 'брон', 'когда можете', 'установить', 'время', 'book', 'appointment', 'schedule', 'slot'],
  support: ['не работает', 'течет', 'течёт', 'протек', 'сломал', 'картридж', 'помогите', 'leak', 'broken', 'help', 'how to'],
  sales: ['цена', 'стоим', 'сколько стоит', 'купить', 'рассрочк', 'price', 'cost', 'buy', 'installment', 'how much'],
};

const TOPICS = {
  pricing: ['цена', 'стоим', 'сколько', 'price', 'cost', 'how much'],
  installment: ['рассрочк', 'installment', 'кредит'],
  delivery: ['доставк', 'delivery', 'привез'],
  installation: ['установк', 'монтаж', 'install'],
};

const includesAny = (text, words) => words.some((w) => text.includes(w));

// Validates and normalizes a classification, whether it came from rules or an LLM.
export function validateClassification(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('classification must be an object');
  const intent = INTENTS.includes(raw.intent) ? raw.intent : 'other';
  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
  const customer_stage = STAGES.includes(raw.customer_stage) ? raw.customer_stage : 'new_lead';
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0));
  const topics = Array.isArray(raw.topics) ? raw.topics.filter((t) => typeof t === 'string').slice(0, 5) : [];
  const needs_human = Boolean(raw.needs_human) || intent === 'complaint';
  return { intent, priority, needs_human, customer_stage, confidence, topics };
}

// Offline fallback: keyword rules, so the demo and tests run without any API key.
export function ruleBasedClassify(text, { customerStage = 'new_lead' } = {}) {
  const t = text.toLowerCase();
  const intent = Object.keys(RULES).find((k) => includesAny(t, RULES[k])) || 'other';
  const topics = Object.keys(TOPICS).filter((k) => includesAny(t, TOPICS[k]));
  return validateClassification({
    intent,
    priority: intent === 'complaint' ? 'high' : intent === 'other' ? 'low' : 'medium',
    needs_human: intent === 'complaint',
    customer_stage: customerStage,
    confidence: intent === 'other' ? 0.4 : 0.8,
    topics,
  });
}

const SYSTEM_PROMPT = `You classify WhatsApp messages for a water-filter store.
Return ONLY a JSON object with these keys:
- intent: one of ${INTENTS.join(' | ')}
- priority: one of ${PRIORITIES.join(' | ')}
- needs_human: true if a manager should take over (angry customer, unclear request, legal or refund questions)
- customer_stage: one of ${STAGES.join(' | ')} (use the hint you are given)
- confidence: number 0..1
- topics: short list such as pricing, installment, delivery, installation
Do not answer the customer. Do not invent data.`;

export async function classify(text, { customerStage = 'new_lead' } = {}) {
  if (!llmEnabled()) return { ...ruleBasedClassify(text, { customerStage }), source: 'rules' };
  try {
    const content = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `customer_stage hint: ${customerStage}\nmessage: ${text}` },
      ],
      { json: true, temperature: 0 },
    );
    return { ...validateClassification(JSON.parse(content)), source: 'llm' };
  } catch {
    // Any LLM or parsing failure degrades to rules instead of breaking the conversation.
    return { ...ruleBasedClassify(text, { customerStage }), source: 'rules-fallback' };
  }
}
