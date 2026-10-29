// All settings come from environment variables, so the demo runs with none of them set.
export const config = {
  port: Number(process.env.PORT || 3000),

  // WhatsApp Cloud API (Meta). Without a token, outgoing messages are only logged.
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'dev-verify-token',
  appSecret: process.env.WHATSAPP_APP_SECRET || '',

  // OpenAI-compatible API. Without a key, rule-based classification and template replies are used.
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Below this confidence the conversation is handed to a human manager.
  handoverConfidence: Number(process.env.HANDOVER_CONFIDENCE || 0.55),
};
