package com.ecotrack.credit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Read-only view of the action_templates table: the only action keys that may earn credits. */
@Component
public class ActionTemplateCatalog {

    private final JdbcTemplate jdbc;

    public ActionTemplateCatalog(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isActive(String actionKey) {
        if (actionKey == null || actionKey.isBlank()) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM action_templates WHERE action_key = ? AND active", Integer.class, actionKey);
        return n != null && n > 0;
    }
}
