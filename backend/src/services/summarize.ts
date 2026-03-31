import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function summarizeConversation(messages: { sender: string; body: string }[]): Promise<string> {
  const transcript = messages
    .map((m) => `${m.sender === 'user' ? 'Us' : 'Contact'}: ${m.body}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Summarise the following DM conversation in 1–2 sentences. Focus on what was discussed and the outcome (e.g. interested, not interested, follow-up needed).\n\n${transcript}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}
