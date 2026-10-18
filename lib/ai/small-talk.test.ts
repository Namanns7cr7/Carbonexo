import { describe, expect, it } from 'vitest';
import { smallTalkReply } from './small-talk';

describe('smallTalkReply', () => {
  it('answers pure small talk instantly', () => {
    expect(smallTalkReply('hii')).toBe('Hey! 👋 How can I help you?');
    expect(smallTalkReply('hello')).toBe('Hey! 👋 How can I help you?');
    expect(smallTalkReply('how are you doing')).toBe("I'm doing well, thanks! How are you?");
    expect(smallTalkReply('how are you doing?')).toBe("I'm doing well, thanks! How are you?");
    expect(smallTalkReply('thanks')).toBe("You're welcome!");
  });
  it('lets real questions through to the coach', () => {
    for (const q of ['what are carbon credits?', 'hi, how many credits do I have?', 'what is my credit score?',
      'can I redeem my credits?', 'how do I reduce emissions?', 'compare my car with a bus for 20 km']) {
      expect(smallTalkReply(q)).toBeNull();
    }
  });
});
