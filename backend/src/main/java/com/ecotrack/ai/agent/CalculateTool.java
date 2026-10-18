package com.ecotrack.ai.agent;

import com.ecotrack.factors.Units;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Exact arithmetic so the model never does sums in its head: per-person shares, totals, per-day
 * figures. Numbers + - * / and parentheses only (a tiny recursive-descent parser; nothing is
 * evaluated as code). The answer verifier then finds the result in this tool's output.
 */
@Component
public class CalculateTool implements CoachTool {

    public static final String NAME = "calculate";

    private static final MathContext MC = MathContext.DECIMAL64;

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Exact arithmetic on numbers from tool results or the user's message, e.g. \"12 * (0.13 - 0.015161)\", \"37.9 / 7\", "
                + "\"40 * 10\". Operators + - * / and parentheses. Use it for every sum, product, share or average you state.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "expression":{"type":"STRING","description":"numbers, + - * / and parentheses only"},
                  "label":{"type":"STRING","description":"what the result means, e.g. kg per person"}},
                 "required":["expression"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("expression", "label"));
        String expr = ToolArgs.str(args, "expression", true, 200);
        String label = ToolArgs.str(args, "label", false, 80);
        List<String> ungrounded = ctx.numbers().ungroundedOperands(expr);
        if (!ungrounded.isEmpty()) {
            throw new ToolArgs.ToolArgumentException("these numbers are not in the user's message or any tool result: "
                    + String.join(", ", ungrounded) + ". Look them up with a tool first; do not use remembered values.");
        }
        BigDecimal v;
        try {
            v = new Parser(expr).parse();
        } catch (ArithmeticException | IllegalArgumentException e) {
            throw new ToolArgs.ToolArgumentException("cannot evaluate: " + e.getMessage());
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("expression", expr);
        if (label != null) m.put("label", label);
        m.put("result", Units.tidy(v));
        return m;
    }

    /** expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ; factor := '-' factor | number | '(' expr ')' */
    static final class Parser {
        private final String s;
        private int i;
        private int depth;

        Parser(String s) { this.s = s; }

        BigDecimal parse() {
            BigDecimal v = expr();
            skip();
            if (i != s.length()) throw new IllegalArgumentException("unexpected '" + s.charAt(i) + "'");
            return v;
        }

        private BigDecimal expr() {
            BigDecimal v = term();
            while (true) {
                skip();
                if (eat('+')) v = v.add(term(), MC);
                else if (eat('-')) v = v.subtract(term(), MC);
                else return v;
            }
        }

        private BigDecimal term() {
            BigDecimal v = factor();
            while (true) {
                skip();
                if (eat('*') || eat('×')) v = v.multiply(factor(), MC);
                else if (eat('/')) {
                    BigDecimal d = factor();
                    if (d.signum() == 0) throw new ArithmeticException("division by zero");
                    v = v.divide(d, MC);
                } else return v;
            }
        }

        private BigDecimal factor() {
            skip();
            if (eat('-')) return factor().negate();
            if (eat('(')) {
                if (++depth > 20) throw new IllegalArgumentException("too deeply nested");
                BigDecimal v = expr();
                skip();
                if (!eat(')')) throw new IllegalArgumentException("missing ')'");
                depth--;
                return v;
            }
            int start = i;
            while (i < s.length() && (Character.isDigit(s.charAt(i)) || s.charAt(i) == '.' || s.charAt(i) == ',')) i++;
            if (start == i) throw new IllegalArgumentException(i < s.length() ? "unexpected '" + s.charAt(i) + "'" : "unexpected end");
            return new BigDecimal(s.substring(start, i).replace(",", ""));
        }

        private boolean eat(char c) {
            if (i < s.length() && s.charAt(i) == c) { i++; return true; }
            return false;
        }

        private void skip() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
        }
    }
}
