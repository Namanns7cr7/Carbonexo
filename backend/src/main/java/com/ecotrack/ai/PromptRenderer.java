package com.ecotrack.ai;

import org.springframework.stereotype.Component;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Renders prompt templates by replacing {{variable}} placeholders with values.
 * Templates are stored in the database, not in code.
 */
@Component
public class PromptRenderer {

    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");

    private final PromptTemplateRepository repo;

    public PromptRenderer(PromptTemplateRepository repo) {
        this.repo = repo;
    }

    /**
     * Render a template by key with the given variables.
     * Returns the raw template body if the key is not found.
     */
    public String render(String templateKey, Map<String, String> variables) {
        PromptTemplate template = repo.findLatestActiveByKey(templateKey).orElse(null);
        if (template == null) {
            return "No template found for key: " + templateKey;
        }
        return substitute(template.getBody(), variables);
    }

    private String substitute(String body, Map<String, String> variables) {
        Matcher matcher = VAR_PATTERN.matcher(body);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1);
            String replacement = variables.getOrDefault(varName, "{{" + varName + "}}");
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }
}
