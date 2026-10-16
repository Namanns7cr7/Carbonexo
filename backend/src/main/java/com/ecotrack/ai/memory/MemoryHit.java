package com.ecotrack.ai.memory;

import java.time.Instant;

/** One retrieved memory with its cosine similarity (1 = identical direction). */
public record MemoryHit(String content, Instant createdAt, double similarity) {}
