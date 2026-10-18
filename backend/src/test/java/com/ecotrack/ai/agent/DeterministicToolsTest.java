package com.ecotrack.ai.agent;

import com.ecotrack.factors.Units;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** calculate / convertUnits: exact, bounded, and unable to launder remembered numbers. */
class DeterministicToolsTest {

    static ToolContext ctx(String userMessage) {
        ToolContext c = new ToolContext(UUID.randomUUID(), "IN", true, LocalDate.now(), new SourceLedger(), false, new GroundedNumbers());
        c.numbers().addText(userMessage);
        return c;
    }

    @Test
    void calculateIsExactArithmetic() {
        ToolContext c = ctx("12 km; factors 0.13 and 0.015161");
        assertEquals(new BigDecimal("1.378068"), new CalculateTool().execute(c, Map.of("expression", "12 * (0.13 - 0.015161)")).get("result"));
        assertEquals(new BigDecimal("-2"), new CalculateTool().execute(ctx("1 3"), Map.of("expression", "-(1 + 3) / 2")).get("result"));
    }

    @Test
    void calculateRejectsRememberedOperands() {
        ToolContext c = ctx("I used 250 kWh");
        var e = assertThrows(ToolArgs.ToolArgumentException.class,
                () -> new CalculateTool().execute(c, Map.of("expression", "250 * 0.82")));
        assertTrue(e.getMessage().contains("0.82"));
        c.numbers().addText("{\"factor_value\":0.710}");   // after a factor tool result it is allowed
        assertEquals(new BigDecimal("177.5"), new CalculateTool().execute(c, Map.of("expression", "250 * 0.710")).get("result"));
    }

    @Test
    void calculateIsNotACodeEvaluator() {
        ToolContext c = ctx("1 2");
        for (String bad : new String[]{"java.lang.Runtime.getRuntime()", "1;DROP TABLE users", "2**10", "1/0", "((((((((((((((((((((((1))))))))))))))))))))))",
                "Math.pow(2,3)", "1 + ", "1e309"}) {
            assertThrows(ToolArgs.ToolArgumentException.class, () -> new CalculateTool().execute(c, Map.of("expression", bad)), bad);
        }
        assertThrows(ToolArgs.ToolArgumentException.class, () -> new CalculateTool().execute(c, Map.of("expression", "1".repeat(201))));
        assertThrows(ToolArgs.ToolArgumentException.class, () -> new CalculateTool().execute(c, Map.of("expression", "1", "userId", "x")));
    }

    @Test
    void conversionsUseStatedConventions() {
        ConvertUnitsTool t = new ConvertUnitsTool();
        assertEquals(new BigDecimal("0.71"), t.execute(ctx("0.710 t CO2/MWh"), Map.of("value", 0.710, "from_unit", "t/MWh", "to_unit", "kg/kWh")).get("result"));
        assertEquals(new BigDecimal("6.849315"), t.execute(ctx("2.5 tonnes per year"), Map.of("value", 2.5, "from_unit", "t/year", "to_unit", "kg/day")).get("result"));
        assertEquals(new BigDecimal("32.18688"), t.execute(ctx("20 miles"), Map.of("value", 20, "from_unit", "mi", "to_unit", "km")).get("result"));
        assertEquals(0, new BigDecimal("0.260714").compareTo((BigDecimal) t.execute(ctx("5 kg per week"),
                Map.of("value", 5, "from_unit", "kg/week", "to_unit", "t/year")).get("result")));
    }

    @Test
    void conversionsRejectNonsenseAndUngroundedValues() {
        ConvertUnitsTool t = new ConvertUnitsTool();
        assertThrows(ToolArgs.ToolArgumentException.class, () -> t.execute(ctx("5 kg"), Map.of("value", 5, "from_unit", "kg", "to_unit", "km")));
        assertThrows(ToolArgs.ToolArgumentException.class, () -> t.execute(ctx("5 kg"), Map.of("value", 5, "from_unit", "kg/kWh", "to_unit", "kg")));
        assertThrows(ToolArgs.ToolArgumentException.class, () -> t.execute(ctx("5 kg"), Map.of("value", 5, "from_unit", "furlongs", "to_unit", "km")));
        assertThrows(ToolArgs.ToolArgumentException.class, () -> t.execute(ctx("no numbers here"), Map.of("value", 0.82, "from_unit", "kg/kWh", "to_unit", "t/MWh")));
    }

    @Test
    void groundedNumbersAcceptRoundingButNotNewValues() {
        GroundedNumbers g = new GroundedNumbers();
        g.addText("{\"factor_value\":0.015161,\"kg\":11.258}");
        assertTrue(g.contains(new BigDecimal("0.0152")));
        assertTrue(g.contains(new BigDecimal("11.26")));
        assertTrue(g.contains(new BigDecimal("4")));      // a small count ("four of us")
        assertTrue(g.contains(new BigDecimal("365")));    // calendar convention
        assertFalse(g.contains(new BigDecimal("0.82")));
        assertFalse(g.contains(new BigDecimal("250")));
        assertEquals(Units.Dimension.DISTANCE, Units.dimension("mi"));
    }
}
