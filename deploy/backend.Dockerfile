# Build context = repo root (so we can copy backend/ AND database/migrations).
# ---- build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn -q -B -DskipTests clean package

# ---- runtime stage ----
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/target/ecotrack-backend-0.1.0.jar app.jar
# Flyway migrations live at repo-root database/migrations; bundle them into the image
COPY database/migrations /app/migrations
ENV FLYWAY_LOCATIONS=filesystem:/app/migrations
# Cloud Run sets PORT (defaults to 8080); Spring reads it (server.port=${PORT:...})
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
