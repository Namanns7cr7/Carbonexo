# Carbonexo EcoMind: Gemini 3 Integration & Protocol Verification

**Audit Date:** 2026-10-18  
**Components Inspected:** `GeminiRestAgentModelClient.java`, `GeminiAgentModelClient.java`, `AgentConfig.java`  
**Target Models:** `gemini-3.0-flash-preview`, `gemini-2.5-flash`  

---

## 1. Architectural Summary & Vertex SDK Limitation

During initial testing of Gemini 3 function calling with the official Vertex AI Java SDK (`com.google.cloud:google-cloud-vertexai:1.12.0`), tool calling failed with:
```
400 INVALID_ARGUMENT: thoughtSignature missing on functionCall turn
```

### The Protocol Root Cause:
Gemini 3 models return a required cryptographic `thoughtSignature` string on each `functionCall` part in the candidate response. When the client sends the subsequent turn containing the `functionResponse`, Google's API specification strictly mandates that the preceding model `functionCall` part must be returned **with the exact `thoughtSignature` intact**.

Because Vertex AI Java SDK 1.12.0 did not yet expose getter/setter methods for `thoughtSignature` on candidate protobuf objects, the SDK dropped the signature, causing Vertex AI to reject the request.

---

## 2. The Solution: `GeminiRestAgentModelClient.java`

To achieve full protocol compatibility with Gemini 3 without waiting for upstream SDK releases, Carbonexo implemented [`GeminiRestAgentModelClient.java`](file:///d:/4%20year/Carbonexo/backend/src/main/java/com/ecotrack/ai/agent/GeminiRestAgentModelClient.java).

### Key Protocol Capabilities:
1. **Direct Vertex REST Protocol:** Communicates directly with:
   `https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent`
2. **Signature Extraction & Roundtrip:**
   - In response parser:
     ```java
     String sig = p.hasNonNull("thoughtSignature") ? p.get("thoughtSignature").asText() : null;
     calls.add(new FunctionCall(fc.path("name").asText(), args, sig));
     ```
   - In request body serializer:
     ```java
     if (fc.thoughtSignature() != null) {
         p.put("thoughtSignature", fc.thoughtSignature());
     }
     ```
3. **Low Thinking Configuration:**
   For `gemini-3.0-flash-preview`, Google recommends enabling low thinking to reduce reasoning latency while maintaining accuracy:
   ```json
   "thinkingConfig": {
       "thinkingLevel": "low"
   }
   ```
4. **Temperature Tuning:**
   - Gemini 3: Uses Google-recommended default temperature (1.0) to prevent looping behavior during tool argument generation.
   - Gemini 2.5: Uses temperature (0.2) for strict deterministic formatting.

---

## 3. Operational Model Verification Matrix

| Model Identifier | Protocol Handler | Single Tool Call | Multi-Tool Calls | Thought Signatures | Production Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gemini-3.0-flash-preview` | `GeminiRestAgentModelClient` | **PASS** | **PASS** | **PASS (Preserved)** | **VERIFIED CANDIDATE** |
| `gemini-2.5-flash` | `GeminiRestAgentModelClient` / SDK | **PASS** | **PASS** | N/A (Not required) | **VERIFIED PRIMARY GA** |
| `canned` | `CannedAgentModelClient` | **PASS** | **PASS** | N/A | **OFFLINE FALLBACK** |

---

## 4. Policy on Model Attribution

1. **No Silent Rebranding:** The frontend displays the genuine backend model label (`Gemini 2.5 Flash`, `Gemini 3 Flash Preview`, or `Offline Reference Library`).
2. **Deterministic Responses:** Simple greetings and small talk handled deterministically are clearly tagged as `deterministic_fast_path` in response metadata to prevent claiming model generation when an LLM was not invoked.
