# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Cache Maven deps separately — only re-downloads when pom.xml changes
COPY mvnw mvnw.cmd pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

# Build fat jar
COPY src ./src
RUN ./mvnw clean package -DskipTests -q

# ── Stage 2: Extract Spring Boot layers ───────────────────────────────────────
# Splits the fat jar into 4 layers ordered by change frequency:
#   dependencies        → 3rd-party libs  (changes rarely → cached longest)
#   spring-boot-loader  → Spring loader   (almost never changes)
#   snapshot-dependencies → SNAPSHOT libs (changes occasionally)
#   application         → your code       (changes every deploy → tiny layer ~1-2 MB)
FROM eclipse-temurin:21-jdk-alpine AS extractor

WORKDIR /app
COPY --from=builder /app/target/spendsense-backend-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Non-root user
RUN addgroup -S spring && adduser -S spring -G spring

# Copy layers in ascending change frequency so Docker cache is maximally reused
COPY --from=extractor /app/dependencies ./
COPY --from=extractor /app/spring-boot-loader ./
COPY --from=extractor /app/snapshot-dependencies ./
COPY --from=extractor /app/application ./

USER spring

EXPOSE 8080

# JVM tuning for 512 MB free-tier container:
#   UseSerialGC          — single-threaded GC; uses ~30% less memory overhead than G1
#   MaxRAMPercentage=60  — caps heap at ~307 MB, leaving ~200 MB for OS/threads/metaspace
#   Xss256k              — reduces each thread's stack from 512k → 256k
#   TieredStopAtLevel=1  — interpreter-only JIT; faster cold start, lower peak RAM
#   urandom              — avoids /dev/random blocking on entropy starvation in containers
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=60.0", \
  "-XX:+UseSerialGC", \
  "-Xss256k", \
  "-XX:TieredStopAtLevel=1", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "org.springframework.boot.loader.launch.JarLauncher"]
