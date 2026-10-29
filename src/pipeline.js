// The whole flow for one incoming message:
// classify (decision) -> retrieve context -> generate reply -> validate -> decide handover.

import { config } from './config.js';
import { classify } from './classify.js';
import { retrieveContext } from './context.js';
import { generateReply } from './reply.js';
import { getStage, recordMessage } from './memory.js';

export async function handleMessage({ from, text }) {
  const classification = await classify(text, { customerStage: getStage(from) });

  // Low confidence is treated like an explicit request for a human.
  if (classification.confidence < config.handoverConfidence && classification.intent !== 'other') {
    classification.needs_human = true;
  }

  const context = retrieveContext(classification, text);
  const reply = await generateReply(classification, context, text);
  const customer = recordMessage(from, classification);

  return {
    from,
    classification,
    context,
    reply: reply.text,
    replySource: reply.source,
    guard: reply.guard,
    handover: classification.needs_human,
    customer,
  };
}
