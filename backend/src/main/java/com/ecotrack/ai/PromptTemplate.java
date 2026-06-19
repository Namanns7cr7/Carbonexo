package com.ecotrack.ai;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Prompt template stored in DB — no prompts hardcoded in business code. */
@Entity
@Table(name = "prompt_templates")
public class PromptTemplate extends BaseEntity {

    @Column(name = "template_key", nullable = false)
    private String templateKey;

    @Column(nullable = false)
    private int version;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(columnDefinition = "jsonb")
    private String variables;

    private String description;

    @Column(nullable = false)
    private boolean active = true;

    public String getTemplateKey() { return templateKey; }
    public int getVersion() { return version; }
    public String getBody() { return body; }
    public String getVariables() { return variables; }
    public String getDescription() { return description; }
    public boolean isActive() { return active; }
}
