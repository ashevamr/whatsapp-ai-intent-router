import { config } from './config.js';

// Minimal OpenAI-compatible chat call. Returns the message text, or throws.
export async function chat(messages, { json = false, temperature = 0.2 } = {}) {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not set');

  const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature,
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export const llmEnabled = () => Boolean(config.openaiApiKey);
