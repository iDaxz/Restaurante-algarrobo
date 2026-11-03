# API de Algarrobo para Render (o cualquier servicio que ejecute contenedores).
# Fase 1: compila el .jar con Maven. Fase 2: solo el JRE, el .jar y los archivos de la web
# (el backend los sirve también, y la galería del panel lista las fotos de assets/img/platos).
# Configuración por variables de entorno: ver .env.example.

FROM eclipse-temurin:21-jdk AS compilar
WORKDIR /src/backend
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY backend/src src
# Las pruebas necesitan PostgreSQL: se corren antes de desplegar (./mvnw test), no aquí.
RUN ./mvnw -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 algarrobo
COPY --from=compilar /src/backend/target/*.jar app.jar
COPY index.html admin.html sitio/
COPY js sitio/js
COPY assets sitio/assets
ENV ALGARROBO_SITIO=/app/sitio/ \
    ALGARROBO_PROXY=native \
    ALGARROBO_COOKIE_SEGURA=true \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
USER algarrobo
EXPOSE 8080
# Render indica el puerto en $PORT.
CMD ["sh", "-c", "exec java -Dserver.port=${PORT:-8080} -jar app.jar"]
