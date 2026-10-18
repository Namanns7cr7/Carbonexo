package com.ecotrack.ai.agent;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/** Strict argument validation for tool calls. Every failure is a {@link ToolArgumentException}. */
public final class ToolArgs {

    private ToolArgs() {}

    public static class ToolArgumentException extends RuntimeException {
        public ToolArgumentException(String message) { super(message); }
    }

    /** Rejects any key not declared by the tool (this is what blocks a model-supplied "userId"). */
    public static void onlyKeys(Map<String, Object> args, Set<String> allowed) {
        for (String k : args.keySet()) {
            if (!allowed.contains(k)) throw new ToolArgumentException("unknown argument '" + k + "'");
        }
    }

    public static String str(Map<String, Object> args, String key, boolean required, int maxLen) {
        Object v = args.get(key);
        if (v == null || v.toString().isBlank()) {
            if (required) throw new ToolArgumentException("missing argument '" + key + "'");
            return null;
        }
        String s = v.toString().trim();
        if (s.length() > maxLen) throw new ToolArgumentException("argument '" + key + "' too long");
        return s;
    }

    public static String oneOf(Map<String, Object> args, String key, Set<String> values, String dflt) {
        String s = str(args, key, dflt == null, 40);
        if (s == null) return dflt;
        if (!values.contains(s)) throw new ToolArgumentException("argument '" + key + "' must be one of " + values);
        return s;
    }

    public static BigDecimal num(Map<String, Object> args, String key, boolean required, double min, double max, Double dflt) {
        Object v = args.get(key);
        if (v == null) {
            if (required) throw new ToolArgumentException("missing argument '" + key + "'");
            return dflt == null ? null : BigDecimal.valueOf(dflt);
        }
        BigDecimal d;
        try {
            d = new BigDecimal(v.toString());
        } catch (NumberFormatException e) {
            throw new ToolArgumentException("argument '" + key + "' must be a number");
        }
        if (d.doubleValue() < min || d.doubleValue() > max) {
            throw new ToolArgumentException("argument '" + key + "' must be between " + min + " and " + max);
        }
        return d;
    }

    public static Integer integer(Map<String, Object> args, String key, int min, int max, Integer dflt) {
        BigDecimal d = num(args, key, false, min, max, dflt == null ? null : dflt.doubleValue());
        return d == null ? null : d.intValue();
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> obj(Map<String, Object> args, String key) {
        Object v = args.get(key);
        if (!(v instanceof Map<?, ?> m)) throw new ToolArgumentException("argument '" + key + "' must be an object");
        return (Map<String, Object>) m;
    }
}
