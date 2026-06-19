package com.ecotrack.ai.service;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Coach chat message (table: coach_messages). */
@Entity
@Table(name = "coach_messages")
public class CoachMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String role;   // user | assistant | system

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    private String provider;
    private String model;
    private Integer tokens;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public Integer getTokens() { return tokens; }
    public void setTokens(Integer tokens) { this.tokens = tokens; }
    public Instant getCreatedAt() { return createdAt; }
}
