/**
 * Deterministic replies for pure small talk ("hii", "how are you doing?", "thanks").
 * Matches only when the WHOLE message is small talk, so "hi, how many credits do I have?"
 * still goes to the coach. No model, RAG, factor or recommendation work happens for these.
 * Mirrors backend com.ecotrack.ai.service.SmallTalk — keep the two in sync.
 */
const TRAIL = String.raw`[\s!?.,~:)😊👋🙂]*`;

const RULES: { re: RegExp; reply: string }[] = [
  {
    re: new RegExp(String.raw`^(hi+|hii+|hello+|hey+|heya|hiya|hola|yo|sup|namaste|good\s*(morning|afternoon|evening))(\s+(there|ecomind|coach))?` + TRAIL + '$', 'i'),
    reply: 'Hey! 👋 How can I help you?',
  },
  {
    re: new RegExp(String.raw`^((hi|hey|hello)[\s,!]+)?(how\s*(are|r)\s*(you|u)(\s*doing)?(\s*today)?|how'?s\s*it\s*going|how\s*do\s*you\s*do|hru|wassup|what'?s\s*up)` + TRAIL + '$', 'i'),
    reply: "I'm doing well, thanks! How are you?",
  },
  {
    re: new RegExp(String.raw`^(thanks?|thank\s*(you|u)|thx|ty|tysm)(\s*(so\s*much|a\s*lot|very\s*much))?` + TRAIL + '$', 'i'),
    reply: "You're welcome!",
  },
  {
    re: new RegExp(String.raw`^(bye+|good\s*bye|goodbye|see\s*(you|ya)(\s*later)?|cya|take\s*care|good\s*night)` + TRAIL + '$', 'i'),
    reply: 'Bye! 🌱 Come back anytime.',
  },
];

export function smallTalkReply(message: string): string | null {
  const q = message.trim();
  if (!q || q.length > 40) return null;
  for (const r of RULES) if (r.re.test(q)) return r.reply;
  return null;
}
