package com.ecotrack;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;

/**
 * Applies Flyway migrations and exits, without starting Spring or the web server. Used by the
 * Cloud Run migration job (MIGRATE_ONLY=true) so schema changes are a separate, explicit step
 * from rolling out application revisions. Reads the same DB_URL / DB_USER / DB_PASSWORD /
 * FLYWAY_LOCATIONS variables as the application and matches its baseline-on-migrate setting.
 */
final class MigrateOnly {

    private MigrateOnly() {}

    static void run() {
        Flyway flyway = Flyway.configure()
                .dataSource(env("DB_URL"), env("DB_USER"), env("DB_PASSWORD"))
                .locations(env("FLYWAY_LOCATIONS"))
                .baselineOnMigrate(true)
                .load();
        var before = flyway.info().current();
        MigrateResult result = flyway.migrate();
        System.out.printf("MIGRATE_ONLY from=%s to=%s executed=%d success=%s%n",
                before == null ? "empty" : before.getVersion(), result.targetSchemaVersion,
                result.migrationsExecuted, result.success);
        if (!result.success) System.exit(1);
    }

    private static String env(String name) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) throw new IllegalStateException(name + " must be set for MIGRATE_ONLY");
        return v;
    }
}
