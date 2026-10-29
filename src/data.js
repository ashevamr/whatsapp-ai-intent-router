import { readFileSync } from 'node:fs';

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

// The catalogue is the single source of truth for prices: the LLM never sees anything else.
export const catalog = load('catalog.json');
export const faq = load('faq.json');
export const slots = load('slots.json').slots;
