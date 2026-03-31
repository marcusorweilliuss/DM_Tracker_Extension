/**
 * Generate a smart summary based on message patterns.
 * Focuses on: what was the outreach about, and what was the outcome.
 */
export async function summarizeConversation(messages: { sender: string; body: string }[]): Promise<string> {
  if (!messages || messages.length === 0) return 'No messages';

  const userMessages = messages.filter((m) => m.sender === 'user');
  const contactMessages = messages.filter((m) => m.sender === 'contact');

  // Determine the topic from the first user message
  const firstUserMsg = userMessages[0];
  const topic = firstUserMsg ? detectTopic(firstUserMsg.body) : 'Outreach';

  // Determine outcome based on conversation flow
  const outcome = detectOutcome(userMessages, contactMessages, messages);

  return `${topic} — ${outcome}`;
}

function detectTopic(body: string): string {
  const lower = body.toLowerCase();
  if (lower.includes('refit') || lower.includes('marketplace') || lower.includes('platform')) {
    return 'Platform outreach';
  }
  if (lower.includes('sell') || lower.includes('listing') || lower.includes('seller')) {
    return 'Seller outreach';
  }
  if (lower.includes('collab') || lower.includes('partner')) {
    return 'Collaboration outreach';
  }
  if (lower.includes('buy') || lower.includes('price') || lower.includes('offer')) {
    return 'Purchase inquiry';
  }
  return 'Outreach';
}

function detectOutcome(
  userMessages: { sender: string; body: string }[],
  contactMessages: { sender: string; body: string }[],
  allMessages: { sender: string; body: string }[]
): string {
  // No response from contact
  if (contactMessages.length === 0) {
    return 'No response yet';
  }

  // Check contact messages for signals
  const allContactText = contactMessages.map((m) => m.body.toLowerCase()).join(' ');
  const lastMsg = allMessages[allMessages.length - 1];

  // Positive signals
  const positiveWords = ['yes', 'sure', 'interested', 'sounds good', 'okay', 'ok', 'great', 'love', 'sign me up', 'let me know', 'how do i', 'tell me more', 'details'];
  const hasPositive = positiveWords.some((w) => allContactText.includes(w));

  // Negative signals
  const negativeWords = ['no thanks', 'not interested', 'no thank', 'pass', 'don\'t want', 'not for me', 'nah', 'sorry'];
  const hasNegative = negativeWords.some((w) => allContactText.includes(w));

  // Question signals
  const questionWords = ['how', 'what', 'when', 'where', 'why', 'can i', 'is it', '?'];
  const hasQuestions = questionWords.some((w) => allContactText.includes(w));

  if (hasNegative) {
    return 'Not interested';
  }

  if (hasPositive && !hasQuestions) {
    return 'Interested';
  }

  if (hasPositive && hasQuestions) {
    return 'Interested, had questions';
  }

  if (hasQuestions) {
    return 'Had questions';
  }

  // Check who sent the last message
  if (lastMsg.sender === 'user') {
    return 'Awaiting response';
  }

  // Contact responded but no clear signal
  return 'Responded';
}
