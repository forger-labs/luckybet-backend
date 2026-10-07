# LuckyBet Premios Backend 🎰🚀

Backend de microservicios y gamificación para la plataforma **LuckyBet**, desarrollado con **NestJS (Fastify)**, **TypeScript**, **TypeORM (PostgreSQL)**, **Redis** y validación estricta con **Zod / nestjs-zod**.

Proporciona un motor de fidelización, misiones interactivas con verificación automática de partidas, cofres semanales/mensuales, progresión por niveles y acreditación de fichas/saldo con gestión de salas de bonificación en LuckyBet.

---

## 🎯 Propósito del Proyecto

El backend de Premios actúa como el núcleo de recompensas y retención para los jugadores de LuckyBet:

1. **Gamificación y Misiones**: Permite a los administradores crear misiones dinámicas diarias, semanales o fijas con pasos manuales (`TEXT`, `IMAGE`) y pasos de juego automáticos (`GAME_PLAY`).
2. **Verificación Automatizada contra LuckyBet**: Comprueba en tiempo real si el jugador cumplió los requisitos de juego (proveedor, juego específico, apuestas mínimas, rondas jugadas) consultando su historial de apuestas en el panel de LuckyBet.
3. **Cofres de Hito (Chests)**: Progresión por periodos de tiempo naturales (semana ISO o mes calendario) donde los jugadores acumulan misiones completadas para desbloquear cofres de recompensas.
4. **Sistema de Niveles (Levels)**: Ascenso progresivo basado en puntos de experiencia (`minExperience`) ganados a través de misiones y cofres.
5. **Recompensas de Nivel (Level Rewards)**: Módulo desacoplado para que el usuario reclame deliberadamente su premio por subir de nivel sin alterar permanentemente su sala base.
6. **Gestión Dinámica de Bonos mediante Salas (Rooms)**: Desacopla la lógica de bonos de los enums estáticos, vinculando las promociones a salas (`BonusRoom`) asociadas a los *seniors* de LuckyBet.
7. **Idempotencia y Reclamos Blindados**: Protocolo transaccional de 5 pasos que garantiza que ninguna recompensa se cobre dos veces y que, en caso de caídas de red o fallos externos, la operación quede aislada para revisión administrativa en estado `TIMEOUT_UNCERTAIN`.

---

## 🏗️ Arquitectura y Tecnologías

- **Framework**: [NestJS 11](https://nestjs.com/) con el adapter de alto rendimiento de **Fastify**.
- **Base de Datos**: **PostgreSQL 16** gestionado mediante **TypeORM** con migraciones dedicadas.
- **Caché en Memoria**: **Redis** con `ioredis` para catálogo de juegos y sesiones de tokens de jugadores.
- **Validación y DTOs**: **Zod** y **nestjs-zod** con generación automática de especificaciones OpenAPI / Swagger (`/docs`).
- **Almacenamiento de Archivos**: **Cloudflare R2 / AWS S3** para imágenes de misiones, niveles y cofres (almacenando claves relativas y generando URLs dinámicas con CDN).
- **Linter y Formateo**: **Biome** (`@biomejs/biome`) para calidad de código y formateo ultrarrápido.
- **Pruebas Unitarias y de Integración**: **Jest** y **Testcontainers** para PostgreSQL real en entornos de prueba.

---

## 📂 Estructura Modular

El proyecto implementa una arquitectura limpia hexagonal/DDD:

```text
src/
├── auth/          # Autenticación JWT y sesiones de administradores (SUPER_ADMIN, REVIEWER)
├── users/         # Gestión de usuarios administrativos
├── panelApi/      # Adaptadores de integración con la API de LuckyBet (AdminPanel y UserPanel)
├── players/       # Gestión de jugadores, experiencia, niveles y sala base
├── levels/        # Configuración de niveles de experiencia y recompensas
├── levelRewards/  # Ledger de reclamos de recompensas por ascenso de nivel
├── rooms/         # Salas con porcentaje de bonificación vinculadas a LuckyBet
├── misiones/      # Catálogo de misiones, pasos, cola de revisión y progreso de usuarios
├── rewards/       # Ledger de reclamos de recompensas de misiones
├── chests/        # Catálogo administrativo de cofres semanales y mensuales
├── playerChests/  # Progreso temporal, inscripción y reclamo de cofres por jugador
├── shared/        # Adaptadores compartidos: S3/R2 storage, Redis cache, Swagger helpers, DB options
└── health/        # Liveness probe y monitoreo de salud del servicio
```

---

## 🔐 Mecanismos de Autenticación

El sistema separa estrictamente los accesos:

1. **Administradores (`Admin JWT`)**: 
   - Autenticación con usuario y contraseña vía `POST /api/v1.0/auth/login`.
   - Se transporta a través de la cookie HTTP-only `accessToken` (protegida contra XSS/CSRF).
   - Controlado por `JwtGuard` y `RolesGuard` (`SUPER_ADMIN` o `REVIEWER`).
2. **Jugadores (`Player Token`)**:
   - Token de sesión de LuckyBet obtenido tras el inicio de sesión del jugador en la plataforma de apuestas.
   - Se envía en cada petición mediante cabecera HTTP:
     ```http
     Authorization: Bearer <playerToken>
     # o alternativamente
     x-player-token: <playerToken>
     ```
   - Controlado por `PlayerTokenGuard` (valida la sesión contra LuckyBet / Redis y auto-registra al jugador en la primera llamada).

---

## 🛡️ Protocolo de Reclamo Seguro (Blindaje de Fichas)

Los reclamos en `rewards` (misiones), `playerChests` (cofres) y `levelRewards` (niveles) implementan el **Protocolo de Retorno Obligatorio a la Sala Base**:

```text
[Cliente: POST claim]
       │
       ▼
1. Bloqueo Atómico (PostgreSQL) ──► Pasa a estado PROCESSING (UQ lock anti doble clic)
       │
       ▼
2. Transferencia Temporal ────────► Mueve al jugador a la sala con bono en LuckyBet
       │                             (Si falla -> aborta y marca TIMEOUT_UNCERTAIN)
       ▼
3. Acreditación de Saldo ─────────► Llama a creditPlayer con fichas en LuckyBet
       │                             (Si da timeout -> marca TIMEOUT_UNCERTAIN)
       ▼
4. Retorno Obligatorio ───────────► Devuelve al jugador a su sala base original
       │                             (Si falla la vuelta -> TIMEOUT_UNCERTAIN)
       ▼
5. Finalización Exitosa ──────────► Pasa a estado CLAIMED
```

Los casos donde ocurre un timeout de red o fallo en el retorno quedan aislados en `TIMEOUT_UNCERTAIN` sin duplicar dinero, listos para ser resueltos por un administrador con un solo clic (`RESOLVE_CLAIMED` o `FORCE_RETRY`).

---

## 📚 Documentación Técnica Detallada

Toda la documentación técnica del proyecto se encuentra en la carpeta [`docs/`](./docs):

- **[Guía de Integración API para Frontend (`docs/endpoints-api-reference.md`)](./docs/endpoints-api-reference.md)**:
  - Documento exhaustivo con **todos los endpoints**, métodos HTTP, tokens requeridos, tipo de contenido (`application/json` vs `multipart/form-data`) y estructuras literales de JSON de entrada y salida sin depender del código backend.
- **[Plan de Módulo LevelRewards y Aislamiento de Niveles (`docs/level-rewards-module-plan.md`)](./docs/level-rewards-module-plan.md)**:
  - Arquitectura del ledger de premios por nivel y desacoplamiento de salas base.
- **[Plan de Implementación de Misiones (`docs/misiones-implementation-plan.md`)](./docs/misiones-implementation-plan.md)**:
  - Especificación técnica del motor de misiones y pasos `GAME_PLAY`.
- **[Blindaje de Reclamos y Niveles (`docs/reward-claim-hardening-and-levels-plan.md`)](./docs/reward-claim-hardening-and-levels-plan.md)**:
  - Análisis del protocolo de transferencia temporal y mitigación de race conditions.
- **[Sincronización Automática de Salas (`docs/rooms-auto-sync-and-build-fix-plan.md`)](./docs/rooms-auto-sync-and-build-fix-plan.md)**:
  - Auto-descubrimiento y creación de salas desde los seniors de LuckyBet.

---

## ⚙️ Configuración y Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basándote en las siguientes variables:

```env
# Servidor
PORT=3030
NODE_ENV=development

# Conexión Base de Datos PostgreSQL
# DATABASE_URL: Puerto 6543 (Transaction Mode con PgBouncer) para tráfico normal de la API
DATABASE_URL="postgresql://postgres:password@aws-0-pooler.supabase.com:6543/postgres?pgbouncer=true"
# DIRECT_URL: Puerto 5432 (Session Mode) obligatorio para correr migraciones DDL
DIRECT_URL="postgresql://postgres:password@aws-0-pooler.supabase.com:5432/postgres"

# Redis Caché
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Administradores
JWT_SECRET=tu_secreto_super_seguro
EXPIRES_IN_TOKEN=86400

# Almacenamiento Cloud (Cloudflare R2 / AWS S3)
STORAGE_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY_ID="tu_access_key"
STORAGE_ACCESS_KEY_SECRET="tu_secret_key"
STORAGE_BUCKET="luckybet-premios"
STORAGE_PUBLIC_URL="https://cdn.luckybet.site"

# Integración con LuckyBet
LUCKYBET_API_BASE="https://api.luckybet.site"
LUCKYBET_DOMAIN="luckybet.site"
LUCKYBET_ADMIN_USER="admin_user"
LUCKYBET_ADMIN_PASS="admin_pass"
```

---

## 🚀 Instalación y Ejecución

```bash
# 1. Instalar dependencias
pnpm install

# 2. Ejecutar migraciones en la base de datos (utiliza DIRECT_URL en puerto 5432)
pnpm run migrate

# 3. Iniciar en modo desarrollo con recarga en caliente
pnpm run start:dev

# 4. Compilar y correr en modo producción
pnpm run build
pnpm run start:prod
```

Una vez levantado, la documentación Swagger interactiva estará disponible en:
```text
http://localhost:3030/docs
```

---

## 🧪 Pruebas y Control de Calidad

De acuerdo con el estándar de desarrollo `@RULES.md`, los comandos de validación de calidad se ejecutan en este orden:

```bash
# 1. Linter y chequeo de estilo con Biome
pnpm exec biome lint src/

# 2. Pruebas unitarias completas
pnpm test

# 3. Limpieza de artefactos compilados anteriores
pnpm run build:clean

# 4. Compilación estricta de TypeScript con NestJS
pnpm run build
```

---

## 📄 Licencia

Este proyecto es software privado y propietario de LuckyBet. Todos los derechos reservados.
