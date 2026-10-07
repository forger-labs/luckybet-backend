# Luckybet Premios — API Reference

Backend NestJS 11 + Fastify. Base URL global: **`/api/v1.0`** · Swagger: `/docs`.

## Convenciones globales

- **Envelope simple**: `buildResponse(data, message, status)` → `{ data, message, status }`
- **Envelope paginado**: `buildPaginatedResponse(...)` → `{ data, message, status, meta: { total, totalPages, page, limit, hasPreviousPage, hasNextPage } }`
- **Body limit**: 10 MiB (`FastifyAdapter`).
- **Multipart global** (`@fastify/multipart`): límite 5 MiB por archivo, 1 archivo, 10 campos. Con `attachFieldsToBody: 'keyValues'` los archivos NO se leen con `req.file()`: quedan en el body como `{ buffer, filename, mimetype }` (via `onFile`).
- **Validación**: el pipe global `ZodValidationPipe` valida solo los bodies con DTO class (`createZodDto`). Los bodies tipados inline **NO se validan**.
- **Auth**: solo `POST /auth/logout` y `GET /auth/me` usan `JwtGuard`. El resto de endpoints están expuestos (los `@ApiCookieAuth` son solo documentación Swagger).

## Enums

| Enum | Valores |
|---|---|
| `MissionType` | `DAILY` \| `WEEKLY` \| `FIXED` |
| `MissionStatus` | `INACTIVE` \| `ACTIVE` \| `COMPLETED` \| `CANCELLED` |
| `StepType` | `IMAGE` \| `TEXT` |
| `StepStatus` | `PENDING` \| `APPROVED` \| `REJECTED` |
| `UserMissionStatus` | `IN_PROGRESS` \| `COMPLETED` \| `EXPIRED` \| `CANCELLED` |
| `AdminRoles` | `SUPER_ADMIN` \| `REVIEWER` |

---

# AUTH — `/api/v1.0/auth`

## POST `/auth/login` — Público

**Formato**: `application/json` · **Respuesta**: `200`

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `username` | string | ✅ | min 3, max 20 |
| `password` | string | ✅ | min 6, max 50 |

**DTO**: `LoginDTO` (`loginSchema`)

**Respuesta** (`LoginResponseDTO`):
```json
{
  "status": true,
  "data": { "accessToken": "string" },
  "message": "Inició sesión exitosamente"
}
```
Además setea cookie `accessToken` httpOnly, `sameSite: lax`, `path: /`, `maxAge` = `EXPIRES_IN_TOKEN` (default 86400).

**Errores**: `404` usuario no existe · `401` "Contraseña inválida"

---

## POST `/auth/logout` — `JwtGuard`

**Formato**: sin body · **Respuesta**: `200`

```json
{ "status": true, "message": "Sesion cerrada exitosamente" }
```
Limpia la cookie `accessToken` (maxAge 0).

---

## GET `/auth/me` — `JwtGuard`

**Formato**: sin body · **Respuesta**: `200` → `data` = entidad `User`

**DTO de salida**: `UserResponseDto` (`userSchemaWithoutPassword`)

```json
{
  "status": true,
  "data": {
    "id": 1,
    "username": "string",
    "role": "SUPER_ADMIN | REVIEWER",
    "isActive": true,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "message": "Success"
}
```
`password` nunca se expone (`select: false`).

---

# USERS — `/api/v1.0/users`

> `@ApiCookieAuth()` es solo documentación — **sin guard real**.

## POST `/users`

**Formato**: `application/json` · **Respuesta**: `201`

**DTO**: `CreateUserDto` (`userSchemaWithoutId`)

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `username` | string | ✅ | min 3, max 20 |
| `password` | string | ✅ | min 6, max 50 |
| `role` | enum | ✅ | `SUPER_ADMIN` \| `REVIEWER` |
| `isActive` | boolean | ❌ | default `true` |

**Respuesta**: `buildResponse(user, 'User created successfully', true)` → `data` = entidad `User` (sin password).

---

## GET `/users`

**Formato**: `application/json` (query) · **Respuesta**: `200`

| Query | Tipo | Requerido |
|---|---|---|
| `take` | number | ❌ |
| `skip` | number | ❌ |

**Respuesta**: `buildPaginatedResponse(users, 'Usuarios obtenidos exitosamente')` → `data: User[]` + `meta`.

---

## GET `/users/:id`

**Formato**: path param · **Respuesta**: `200`

| Path | Tipo |
|---|---|
| `id` | number |

**Respuesta**: `buildResponse(user, 'Usuario obtenido exitosamente')` → `data: User`.

---

## PATCH `/users/:id`

**Formato**: `application/json` · **Respuesta**: `200`

**DTO**: `UpdateUserDto` (`userSchemaOptional`) — todos opcionales

| Campo | Tipo | Reglas |
|---|---|---|
| `username` | string | min 3, max 20 |
| `password` | string | min 6, max 50 |
| `role` | enum | `SUPER_ADMIN` \| `REVIEWER` |
| `isActive` | boolean | — |

**Respuesta**: `buildResponse(user, 'Usuario editado exitosamente')` → `data: User`.

---

# PLAYERS — `/api/v1.0/players`

> `@ApiCookieAuth()` es solo documentación — **sin guard real**.

## POST `/players`

**Formato**: `application/json` · **Respuesta**: `201`

**DTO**: `CreatePlayerDto` (`playerSchemaWithoutId`)

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `username` | string | ✅ | min 1, max 100 |
| `phone` | string \| null | ❌ | max 20 |
| `isActive` | boolean | ❌ | default `true` |

**Respuesta**: `buildResponse(player, 'Player created successfully')` → `data: Player`:

```json
{
  "status": true,
  "data": { "id": 1, "username": "string", "phone": "string|null", "isActive": true },
  "message": "Player created successfully"
}
```

---

## GET `/players`

**Formato**: query · **Respuesta**: `200`

| Query | Tipo | Requerido |
|---|---|---|
| `take` | number | ❌ |
| `skip` | number | ❌ |

**Respuesta**: paginado → `data: Player[]` + `meta`.

---

## GET `/players/:id`

**Formato**: path param · **Respuesta**: `200` → `data: Player`.

---

## PATCH `/players/:id`

**Formato**: `application/json` · **Respuesta**: `200`

**DTO**: `UpdatePlayerDto` (`playerSchemaOptional`) — todos opcionales

| Campo | Tipo | Reglas |
|---|---|---|
| `username` | string | min 1, max 100 |
| `phone` | string \| null | max 20 |
| `isActive` | boolean | — |

**Respuesta**: `buildResponse(player, 'Player editado exitosamente')` → `data: Player`.

---

# MISIONES (admin) — `/api/v1.0/missions`

> `@ApiCookieAuth()` es solo documentación — **sin guard real**.

## POST `/missions`

**Formato**: `multipart/form-data` · **Respuesta**: `201`

**DTO**: `CreateMissionMultipartDto` (`createMissionMultipartSchema`)

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `title` | string | ✅ | min 1, max 200 |
| `description` | string | ❌ | — |
| `type` | enum | ✅ | `DAILY` \| `WEEKLY` \| `FIXED` |
| `coinsAmount` | string → number | ✅ | se coercea; int ≥ 0 |
| `bonus` | string → number | ❌ | se coercea; int ≥ 0 |
| `experiencePoints` | string → number | ✅ | se coercea; int ≥ 0 |
| `missionSteps` | JSON string o array | ❌ | máx 50; cada step: `stepOrder` int ≥ 1 req, `type` enum `IMAGE`\|`TEXT` req, `content` string opt |
| `image` | **file binary** | ✅ | JPEG \| PNG, ≤ 5 MiB |

**Nota**: los campos numéricos llegan como string (multipart) y se coercionan. `missionSteps` puede venir como string JSON (`[{"stepOrder":1,...}]`) o como array ya parseado.

**Respuesta**: `buildResponse(mission, 'Mision creada exitosamente')` → `data: MissionWithSteps`:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "title": "string",
    "description": "string?",
    "type": "DAILY | WEEKLY | FIXED",
    "status": "INACTIVE",
    "coinsAmount": 100,
    "bonus": 0,
    "experiencePoints": 50,
    "imageUrl": "string",
    "activatedAt": "timestamp?",
    "expiresAt": "timestamp?",
    "steps": [
      { "id": 1, "missionId": 1, "stepOrder": 1, "type": "TEXT", "content": "string?" }
    ]
  },
  "message": "Mision creada exitosamente"
}
```

---

## GET `/missions`

**Formato**: query · **Respuesta**: `200`

| Query | Tipo | Requerido |
|---|---|---|
| `take` | number | ❌ |
| `skip` | number | ❌ |

**Respuesta**: paginado → `data: MissionBasic[]` + `meta`. `MissionBasic` = campos de misión sin `steps`.

---

## GET `/missions/:id`

**Formato**: path param · **Respuesta**: `200` → `data: MissionWithSteps`.

---

## PATCH `/missions/:id`

**Formato**: `application/json` · **Respuesta**: `200`

**DTO**: `UpdateMissionDto` (`updateMissionSchema`) — todos opcionales

| Campo | Tipo | Reglas |
|---|---|---|
| `title` | string | min 1, max 200 |
| `description` | string | — |
| `type` | enum | `DAILY` \| `WEEKLY` \| `FIXED` |
| `status` | enum | `INACTIVE` \| `ACTIVE` \| `COMPLETED` \| `CANCELLED` |
| `coinsAmount` | number | int ≥ 0 |
| `bonus` | number | int ≥ 0 |
| `experiencePoints` | number | int ≥ 0 |
| `imageUrl` | string | formato URL, max 500 |

**Nota**: el contenido de una misión es inmutable después de activarse (400).

**Respuesta**: `buildResponse(mission, 'Mision actualizada exitosamente')` → `data: MissionBasic`.

---

## POST `/missions/:id/activate`

**Formato**: sin body · **Respuesta**: `200`

Solo funciona si `status === INACTIVE`. `WEEKLY` → `expiresAt` +7 días; `DAILY` → +24 h.

**Respuesta**: `buildResponse(mission, 'Mision activada exitosamente')` → `data: MissionBasic`.

---

## PATCH `/missions/:id/status`

**Formato**: `application/json` · **Respuesta**: `200`

**Body inline (SIN validación DTO)**:

| Campo | Tipo | Requerido |
|---|---|---|
| `status` | enum | ✅ `MissionStatus` |

Transiciones válidas: `INACTIVE → ACTIVE|CANCELLED`, `ACTIVE → COMPLETED|CANCELLED`.

**Respuesta**: `buildResponse(mission, 'Estado actualizado exitosamente')` → `data: MissionBasic`.

---

## POST `/missions/:id/image`

**Formato**: `multipart/form-data` · **Respuesta**: `200`

| Campo | Tipo | Requerido |
|---|---|---|
| `file` | **file binary** | ✅ (400 si falta) |

JPEG/PNG, ≤ 5 MiB (validado en core). **Respuesta**: `buildResponse(mission, 'Imagen reemplazada exitosamente')` → `data: MissionBasic`.

---

## DELETE `/missions/:id/image`

**Formato**: sin body · **Respuesta**: `200` → `buildResponse(mission, 'Imagen eliminada exitosamente')` → `data: MissionBasic`.

---

# MISIONES (player) — `/api/v1.0/...`

> Controlador sin prefix propio (`@Controller()`), rutas a nivel raíz. `@ApiCookieAuth()` solo documentación — **sin guard real**.

## POST `/players/:playerId/missions/:missionId/start`

**Formato**: sin body · **Respuesta**: `201`

| Path | Tipo |
|---|---|
| `playerId` | number |
| `missionId` | number |

Valida que la misión esté `ACTIVE`, no haya expirado y el jugador no la tenga ya iniciada/completada.

**Respuesta**: `buildResponse(result, 'Mision iniciada exitosamente')` → `data: UserMissionBasic`:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "playerId": 1,
    "missionId": 1,
    "status": "IN_PROGRESS",
    "currentStep": 1,
    "startedAt": "timestamp",
    "completedAt": "timestamp?"
  },
  "message": "Mision iniciada exitosamente"
}
```

---

## POST `/players/:playerId/missions/:userMissionId/steps/:stepId/submit`

**Formato**: `multipart/form-data` · **Respuesta**: `200`

| Path | Tipo |
|---|---|
| `playerId` | number (no usado) |
| `userMissionId` | number |
| `stepId` | number |

**DTO**: `SubmitStepMultipartDto` (`submitStepMultipartSchema`)

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `submissionText` | string | condicional | requerido en pasos `TEXT` |
| `submissionImage` | **file binary** | condicional | JPEG \| PNG, ≤ 5 MiB; requerido en pasos `IMAGE` |

**Comportamiento condicional (paso de la misión)**:
- Paso `IMAGE`: exige `submissionImage` (400 si falta). Sube la imagen a storage (folder `steps`) y persiste la URL en `submissionImageUrl`.
- Paso `TEXT`: exige `submissionText` (400 si falta). Si se envía `submissionImage` → **400** "Este paso no requiere imagen".

También valida orden del paso (`stepOrder` debe ser el actual).

**Respuesta**: `buildResponse(result, 'Paso enviado exitosamente')` → `data: StepSubmission`:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "userMissionId": 1,
    "missionStepId": 1,
    "status": "PENDING",
    "submissionText": "string?",
    "submissionImageUrl": "string?",
    "reviewedById": 1,
    "reviewedAt": "timestamp?",
    "reviewerNotes": "string?"
  },
  "message": "Paso enviado exitosamente"
}
```

---

## GET `/players/:playerId/missions`

**Formato**: query · **Respuesta**: `200`

| Query | Tipo | Requerido |
|---|---|---|
| `take` | number | ❌ |
| `skip` | number | ❌ |

**Respuesta**: paginado → `data: UserMissionBasic[]` + `meta`.

---

## GET `/players/:playerId/missions/:userMissionId`

**Formato**: path param · **Respuesta**: `200`

| Path | Tipo |
|---|---|
| `playerId` | number (no usado) |
| `userMissionId` | number |

**Respuesta**: `buildResponse(result, 'Mision obtenida exitosamente')` → `data: UserMissionWithSteps`:

```json
{
  "status": true,
  "data": {
    "id": 1,
    "playerId": 1,
    "missionId": 1,
    "status": "IN_PROGRESS",
    "currentStep": 1,
    "startedAt": "timestamp?",
    "completedAt": "timestamp?",
    "steps": [ "StepSubmission[]" ]
  },
  "message": "Mision obtenida exitosamente"
}
```

---

## GET `/admin/missions/review-queue`

**Formato**: query · **Respuesta**: `200`

| Query | Tipo | Requerido | Reglas |
|---|---|---|---|
| `status` | enum | ❌ | `StepStatus` \| `UserMissionStatus`; default `PENDING` |
| `playerId` | number | ❌ | — |
| `experience` | number | ❌ | umbral: `experiencePoints >= experience` |
| `coinsAmount` | number | ❌ | igualdad exacta sobre `coinsAmount` |
| `type` | enum | ❌ | `DAILY` \| `WEEKLY` \| `FIXED` |
| `take` | number | ❌ | default `100`; pagina **jugadores**, no filas de steps |
| `skip` | number | ❌ | default `0` |

**Semántica de `status`**:
- `StepStatus` (`PENDING` / `APPROVED` / `REJECTED`) → una misión califica si tiene **≥1 step** con ese status; solo se muestran esos steps.
- `UserMissionStatus` (`IN_PROGRESS` / `COMPLETED` / `EXPIRED` / `CANCELLED`) → filtra `userMission.status`; se muestran **todos** los steps de esas misiones.
- Sin parámetro → default `PENDING`.

**Respuesta**: `buildPaginatedResponse(players, 'Cola de revision obtenida exitosamente', true, { skip, limit, total })` → paginado por **jugador**: `data: ReviewQueueByPlayer[]` + `meta`:

```json
{
  "status": true,
  "data": [
    {
      "playerId": 1,
      "playerName": "string?",
      "missions": [
        {
          "userMissionId": 1,
          "missionId": 1,
          "missionTitle": "string",
          "missionDescription": "string?",
          "missionType": "DAILY | WEEKLY | FIXED",
          "coinsAmount": 100,
          "experiencePoints": 50,
          "userMissionStatus": "IN_PROGRESS",
          "imageUrl": "string?",
          "steps": [ "StepSubmission[]" ]
        }
      ]
    }
  ],
  "message": "Cola de revision obtenida exitosamente"
}
```

**Nota**: `meta.total` cuenta **jugadores distintos**, no steps. `submissionImageUrl` (de cada step) e `imageUrl` (de la misión) llegan como URLs públicas.

**Aviso**: endpoint expuesto **sin autenticación** (los `@ApiCookieAuth` son solo documentación).

---

## POST `/admin/missions/steps/:stepId/review`

**Formato**: `application/json` · **Respuesta**: `200`

| Path | Tipo |
|---|---|
| `stepId` | number |

**Body inline (SIN validación DTO)**:

| Campo | Tipo | Requerido |
|---|---|---|
| `status` | enum | ✅ `'APPROVED'` \| `'REJECTED'` |
| `reviewerNotes` | string | ❌ |

**Nota**: `reviewerId` hardcodeado en `1` (TODO). Al aprobar, avanza `currentStep` o completa la misión si era el último paso.

**Respuesta**: `buildResponse(result, 'Revision completada exitosamente')` → `data: StepSubmission`.

---

# HEALTH — `/api/v1.0/health`

## GET `/health` — Público

**Formato**: sin body · **Respuesta**: `200`

```json
{ "status": true, "message": "Service is running" }
```

---

## Estructuras de datos (resumen)

| Tipo | Campos |
|---|---|
| `User` | id, username, role, isActive, created_at, updated_at |
| `Player` | id, username, phone?, isActive |
| `MissionBasic` | id, title, description?, type, status, coinsAmount, bonus?, experiencePoints, imageUrl?, activatedAt?, expiresAt? |
| `MissionStepBasic` | id, missionId, stepOrder, type, content? |
| `MissionWithSteps` | `MissionBasic` + steps: `MissionStepBasic[]` |
| `UserMissionBasic` | id, playerId, missionId, status, currentStep, startedAt?, completedAt? |
| `StepSubmission` | id, userMissionId, missionStepId, status, submissionText?, submissionImageUrl?, reviewedById?, reviewedAt?, reviewerNotes? |
| `UserMissionWithSteps` | `UserMissionBasic` + steps: `StepSubmission[]` |
| `ReviewQueueByPlayer` | playerId, playerName?, missions: { userMissionId, missionId, missionTitle, missionDescription?, missionType, coinsAmount, experiencePoints, userMissionStatus, imageUrl?, steps: `StepSubmission[]` }[] |
