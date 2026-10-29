// Generation layer: the LLM only phrases the answer from verified context.
// A validation step then rejects any reply that mentions an amount not in the catalogue.

import { chat, llmEnabled } from './llm.js';
import { allowedAmounts } from './context.js';

export const isRussian = (text) => /[а-яё]/i.test(text);

const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

// Deterministic replies: used when no LLM is configured and as the safe fallback.
export function templateReply(classification, context, text) {
  const ru = isRussian(text);

  if (classification.needs_human) {
    return ru
      ? 'Понимаю. Передаю ваш вопрос менеджеру, он ответит в ближайшее время.'
      : 'I understand. I am passing your message to a manager who will reply shortly.';
  }

  switch (classification.intent) {
    case 'sales': {
      const lines = context.products.map((p) => {
        const plan = p.installment
          ? ru
            ? ` (рассрочка ${p.installment.months} мес. по ${fmt(p.installment.monthly)} ₸)`
            : ` (installment ${p.installment.months} mo × ${fmt(p.installment.monthly)} ₸)`
          : '';
        return `• ${p.name}: ${fmt(p.price)} ₸${plan}`;
      });
      return (ru ? 'Вот актуальные цены:\n' : 'Current prices:\n') + lines.join('\n');
    }
    case 'support':
      if (context.articles.length) {
        return context.articles.map((a) => (ru ? a.answer_ru : a.answer_en)).join('\n');
      }
      return ru
        ? 'Опишите, пожалуйста, проблему подробнее или пришлите фото.'
        : 'Please describe the problem in more detail or send a photo.';
    case 'booking':
      return (ru ? 'Свободное время для установки: ' : 'Available installation slots: ') + context.slots.join(', ');
    default:
      return ru
        ? 'Здравствуйте! Подскажите, что вас интересует: цены, установка или сервис?'
        : 'Hello! What can I help you with: prices, installation or service?';
  }
}

// Guardrail: every number that looks like money must exist in the catalogue context.
export function checkAmounts(reply, context) {
  const allowed = allowedAmounts(context);
  // Thousands may be separated by spaces, dots or commas ("89 000", "89,000"); line breaks end a number.
  const found = [...reply.matchAll(/\d[\d  .,]*\d|\d/g)]
    .map((m) => Number(m[0].replace(/[  .,]/g, '')))
    .filter((n) => n >= 1000);
  const invented = found.filter((n) => !allowed.has(n));
  return { ok: invented.length === 0, invented };
}

export async function generateReply(classification, context, text) {
  const template = templateReply(classification, context, text);
  if (!llmEnabled() || classification.needs_human) {
    return { text: template, source: 'template', guard: { ok: true, invented: [] } };
  }

  try {
    const draft = await chat([
      {
        role: 'system',
        content:
          'You are a friendly WhatsApp sales assistant. Answer in the customer\'s language, in 1–4 short sentences. ' +
          'Use ONLY the facts in CONTEXT. Never mention a price, discount or date that is not in CONTEXT. ' +
          'If CONTEXT is not enough, say a manager will follow up.',
      },
      { role: 'user', content: `CONTEXT: ${JSON.stringify(context)}\nCUSTOMER: ${text}` },
    ]);
    const guard = checkAmounts(draft, context);
    // If the model mentioned an amount we can't verify, send the safe template instead.
    return guard.ok
      ? { text: draft, source: 'llm', guard }
      : { text: template, source: 'template-guarded', guard };
  } catch {
    return { text: template, source: 'template-fallback', guard: { ok: true, invented: [] } };
  }
}
