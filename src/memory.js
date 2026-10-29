// In-memory customer state keyed by phone number (E.164).
// In production this would be the CRM / database shared by all channels.

const customers = new Map();

export function getStage(phone) {
  return customers.get(phone)?.stage || 'new_lead';
}

export function recordMessage(phone, classification) {
  const current = customers.get(phone) || { stage: 'new_lead', messages: 0, leadScore: 0 };
  current.messages += 1;

  // Simple lead scoring: buying signals raise the score, complaints lower it.
  const delta = { sales: 20, booking: 30, support: 5, complaint: -10, other: 0 }[classification.intent] ?? 0;
  current.leadScore = Math.max(0, Math.min(100, current.leadScore + delta));
  if (current.stage === 'new_lead' && current.leadScore >= 40) current.stage = 'qualified_lead';

  customers.set(phone, current);
  return current;
}

export function resetMemory() {
  customers.clear();
}
