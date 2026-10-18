package com.ecotrack.ai.agent;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Numbers the sources that tool results actually contained ([S1], [S2], ...). The model may cite only
 * these markers; anything else is stripped by the verifier. Sources are scientific/government
 * references only: never user data.
 */
public class SourceLedger {

    public record Source(String marker, String key, String kind, String sourceId, String title, String resource, String locator,
                         String reviewStatus) {}

    private static final Pattern MARKER = Pattern.compile("\\[(S\\d{1,2})\\]");
    /** Models also write grouped markers: [S1, S2], [S1; S2] or [S1-S3]; normalised to [S1][S2][S3]. */
    private static final Pattern GROUP = Pattern.compile("\\[\\s*(S\\d{1,2}(?:\\s*[,;\\-–]\\s*S?\\d{1,2})+)\\s*\\]");
    private final Map<String, Source> byKey = new LinkedHashMap<>();

    /** @return the marker ("S1") for this source, registering it on first use. */
    public synchronized String cite(String key, String kind, String sourceId, String title, String resource, String locator,
                                    String reviewStatus) {
        Source s = byKey.get(key);
        if (s == null) {
            s = new Source("S" + (byKey.size() + 1), key, kind, sourceId, title, resource, locator, reviewStatus);
            byKey.put(key, s);
        }
        return s.marker();
    }

    public synchronized List<Source> all() {
        return new ArrayList<>(byKey.values());
    }

    /** Rewrites grouped citations ([S1, S2], [S1-S3]) as individual markers ([S1][S2][S3]). */
    public static String normalize(String text) {
        Matcher g = GROUP.matcher(text == null ? "" : text);
        StringBuilder sb = new StringBuilder();
        while (g.find()) {
            StringBuilder rep = new StringBuilder();
            String body = g.group(1).replace(" ", "");
            if (body.matches("S\\d{1,2}[-–]S?\\d{1,2}")) {
                String[] ends = body.split("[-–]");
                int a = Integer.parseInt(ends[0].substring(1)), b = Integer.parseInt(ends[1].replace("S", ""));
                for (int i = a; i <= Math.min(b, a + 20); i++) rep.append("[S").append(i).append(']');
            } else {
                for (String part : body.split("[,;]")) rep.append('[').append(part.startsWith("S") ? part : "S" + part).append(']');
            }
            g.appendReplacement(sb, Matcher.quoteReplacement(rep.toString()));
        }
        g.appendTail(sb);
        return sb.toString();
    }

    /** Markers the answer uses, in order of first appearance. */
    public static Set<String> markersIn(String text) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = MARKER.matcher(text == null ? "" : text);
        while (m.find()) out.add(m.group(1));
        return out;
    }

    /** Removes markers that do not correspond to a registered source. */
    public synchronized String stripUnknownMarkers(String text) {
        Set<String> known = new LinkedHashSet<>();
        byKey.values().forEach(s -> known.add(s.marker()));
        Matcher m = MARKER.matcher(text == null ? "" : text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) m.appendReplacement(sb, known.contains(m.group(1)) ? Matcher.quoteReplacement(m.group()) : "");
        m.appendTail(sb);
        return sb.toString();
    }

    public synchronized List<Source> cited(String text) {
        Set<String> used = markersIn(text);
        return byKey.values().stream().filter(s -> used.contains(s.marker())).toList();
    }
}
