package com.ecotrack.ai.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmallTalkTest {

    @Test
    void greetingsGetInstantReplies() {
        assertThat(SmallTalk.reply("hii")).contains("Hey! 👋 How can I help you?");
        assertThat(SmallTalk.reply("Hello!")).contains("Hey! 👋 How can I help you?");
        assertThat(SmallTalk.reply("how are you doing")).contains("I'm doing well, thanks! How are you?");
        assertThat(SmallTalk.reply("how are you doing?")).contains("I'm doing well, thanks! How are you?");
        assertThat(SmallTalk.reply("thanks")).contains("You're welcome!");
    }

    @Test
    void realQuestionsGoToTheCoach() {
        assertThat(SmallTalk.reply("what are carbon credits?")).isEmpty();
        assertThat(SmallTalk.reply("hi, how many credits do I have?")).isEmpty();
        assertThat(SmallTalk.reply("how can I reduce my electricity consumption?")).isEmpty();
        assertThat(SmallTalk.reply("compare my car with a bus for 20 km")).isEmpty();
        assertThat(SmallTalk.reply("thanks, what is my credit score?")).isEmpty();
    }
}
