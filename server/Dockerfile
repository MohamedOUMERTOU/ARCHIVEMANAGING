# ── Étape 1 : compilation ──
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
# Dépendances d'abord : elles restent en cache tant que le pom.xml ne change pas
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# ── Étape 2 : exécution (JRE seul, utilisateur non root) ──
FROM eclipse-temurin:25-jre
# Tesseract (reconnaissance de texte) : français, arabe, anglais, et détection de l'orientation des pages
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
       tesseract-ocr tesseract-ocr-fra tesseract-ocr-ara tesseract-ocr-eng tesseract-ocr-osd fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home /app ged \
    && mkdir -p /data/storage \
    && chown ged /data/storage
WORKDIR /app
COPY --from=build /src/target/ged-server.jar app.jar
USER ged
ENV STORAGE_DIR=/data/storage
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=10 \
    CMD curl -fsS http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
