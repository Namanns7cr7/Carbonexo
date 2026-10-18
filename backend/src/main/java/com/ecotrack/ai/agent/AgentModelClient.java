package com.ecotrack.ai.agent;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Provider-neutral function-calling model interface for the agentic coach. The Gemini
 * implementation is {@link GeminiAgentModelClient}; tests script a fake.
 */
public interface AgentModelClient {

    enum Role { USER, MODEL, TOOL }

    /** {@code thoughtSignature}: opaque Gemini 3 token that must be sent back unchanged with this call; null otherwise. */
    record FunctionCall(String name, Map<String, Object> args, String thoughtSignature) {
        public FunctionCall(String name, Map<String, Object> args) { this(name, args, null); }
    }

    record FunctionResult(String name, Map<String, Object> response) {}

    /** One conversation turn: user text, model text and/or function calls, or tool results. */
    record Message(Role role, String text, List<FunctionCall> calls, List<FunctionResult> results) {
        public static Message user(String text) { return new Message(Role.USER, text, List.of(), List.of()); }
        public static Message model(String text, List<FunctionCall> calls) { return new Message(Role.MODEL, text, calls, List.of()); }
        public static Message tools(List<FunctionResult> results) { return new Message(Role.TOOL, null, List.of(), results); }
    }

    /** A tool exposed to the model. {@code parametersJson} is a Gemini/OpenAPI schema with UPPERCASE types. */
    record ToolSpec(String name, String description, String parametersJson) {}

    /** {@code forceTools}: when non-empty, the model must call one of these tools (function-calling mode ANY). */
    record Request(String model, String systemInstruction, List<Message> messages, List<ToolSpec> tools,
                   int maxOutputTokens, Duration timeout, List<String> forceTools) {
        public Request(String model, String systemInstruction, List<Message> messages, List<ToolSpec> tools,
                       int maxOutputTokens, Duration timeout) {
            this(model, systemInstruction, messages, tools, maxOutputTokens, timeout, List.of());
        }
    }

    record Response(String text, List<FunctionCall> calls, int inputTokens, int outputTokens, String finishReason) {}

    /** @throws com.ecotrack.ai.AIProviderException classified failure; never returns fallback text */
    Response generate(Request request);

    String providerName();
}
