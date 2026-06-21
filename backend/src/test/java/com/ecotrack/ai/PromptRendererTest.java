package com.ecotrack.ai;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class PromptRendererTest {

    private final PromptTemplateRepository repo = mock(PromptTemplateRepository.class);
    private final PromptRenderer renderer = new PromptRenderer(repo);

    private void stubTemplate(String body) {
        PromptTemplate t = mock(PromptTemplate.class);
        when(t.getBody()).thenReturn(body);
        when(repo.findLatestActiveByKey(anyString())).thenReturn(Optional.of(t));
    }

    @Test
    void substitutesPlaceholdersWithValues() {
        stubTemplate("Hello {{name}}, your top source is {{source}}.");
        String out = renderer.render("coach", Map.of("name", "Yash", "source", "travel"));
        assertEquals("Hello Yash, your top source is travel.", out);
    }

    @Test
    void leavesUnknownPlaceholderIntact() {
        stubTemplate("Hi {{name}} from {{city}}");
        String out = renderer.render("coach", Map.of("name", "Yash"));
        assertEquals("Hi Yash from {{city}}", out);
    }

    @Test
    void handlesTemplateWithNoPlaceholders() {
        stubTemplate("Static prompt body");
        assertEquals("Static prompt body", renderer.render("coach", Map.of()));
    }

    @Test
    void treatsReplacementLiterally() {
        // a value containing $ or \ must not be interpreted as a regex backreference
        stubTemplate("Path: {{p}}");
        String out = renderer.render("coach", Map.of("p", "C:\\temp\\$x"));
        assertEquals("Path: C:\\temp\\$x", out);
    }

    @Test
    void returnsFallbackWhenTemplateMissing() {
        when(repo.findLatestActiveByKey(anyString())).thenReturn(Optional.empty());
        String out = renderer.render("missing", Map.of());
        assertTrue(out.contains("No template found"));
        assertTrue(out.contains("missing"));
    }
}
