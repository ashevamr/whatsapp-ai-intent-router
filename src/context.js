// Context retrieval: for each intent, fetch only the small slice of verified data the reply needs,
// instead of pasting the whole catalogue into a giant prompt.

import { catalog, faq, slots } from './data.js';

const matches = (text, keywords) => keywords.some((k) => text.includes(k));

export function retrieveContext(classification, text) {
  const t = text.toLowerCase();

  switch (classification.intent) {
    case 'sales': {
      const found = catalog.products.filter((p) => matches(t, p.keywords));
      const products = (found.length ? found : catalog.products.slice(0, 3)).map(
        ({ id, name, price, installment, specs }) => ({ id, name, price, installment, specs }),
      );
      return { currency: catalog.currency, products };
    }
    case 'support': {
      const articles = faq.filter((f) => matches(t, f.keywords)).slice(0, 2);
      return { articles };
    }
    case 'booking':
      return { slots: slots.slice(0, 3) };
    default:
      return {};
  }
}

// Every amount the bot is allowed to mention. Used by the price guardrail.
export function allowedAmounts(context) {
  const amounts = new Set();
  for (const p of context.products || []) {
    amounts.add(p.price);
    if (p.installment) amounts.add(p.installment.monthly);
  }
  return amounts;
}
