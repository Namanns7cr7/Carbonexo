package com.ecotrack.social;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** A household/friend group used for leaderboards and shared goal progress (table: groups). */
@Entity
@Table(name = "groups")
public class Group extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(name = "invite_code", nullable = false)
    private String inviteCode;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // --- getters / setters ---
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    /** Convenience alias for the group creator — BaseEntity tracks it via JPA auditing. */
    public UUID getCreatedByUserId() { return getCreatedBy(); }
}
