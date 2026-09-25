# Especificación de Integración de la API (Frontend / Clientes)

> Guía exhaustiva y técnica para el equipo de frontend. Contiene **todos** los endpoints, métodos HTTP, cabeceras requeridas, tokens de autorización, formato de contenido (`application/json` vs `multipart/form-data`) y los esquemas literales de JSON completos para cada petición (Request Body / Query Params) y respuesta (Response Body).

---

## 1. Convenciones Globales y Autenticación

### 1.1 Formato Estándar de Respuesta

Todos los endpoints del backend responden bajo una de estas dos estructuras estándar:

#### A. Respuesta Simple (`apiResponseSchema`)
```json
{
  "status": true,
  "message": "Mensaje descriptivo del resultado",
  "data": { ... } // Objeto del recurso
}
```

#### B. Respuesta Paginada (`paginatedResponseSchema`)
```json
{
  "status": true,
  "message": "Mensaje descriptivo del resultado",
  "data": [ ... ], // Arreglo de elementos
  "meta": {
    "total": 120,        // Total global de registros que coinciden con los filtros
    "totalPages": 6,     // Total de páginas calculadas
    "page": 1,           // Página actual (1-indexed)
    "limit": 20,         // Registros por página solicitados (take)
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

#### C. Respuestas de Error Estándar
```json
{
  "statusCode": 400,
  "message": "Descripción clara del error de validación o regla de negocio",
  "error": "Bad Request"
}
```

---

### 1.2 Mecanismos de Autenticación y Tokens

Existen **dos tokens completamente distintos** según el tipo de cliente:

| Tipo de Token | ¿Quién lo usa? | Tipo de Cabecera / Transporte | Cómo se obtiene |
| :--- | :--- | :--- | :--- |
| **Admin JWT** | Administradores (`SUPER_ADMIN`, `REVIEWER`) | **Cookie HTTP-only** llamada `accessToken` enviada automáticamente por el navegador en cada request (`credentials: 'include'` en `fetch` o `withCredentials: true` en `axios`). | Al llamar a `POST /api/v1.0/auth/login`. |
| **Player Token** | Jugadores finales de LuckyBet | **Header HTTP**: `Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`. Alternativamente vía query param: `?token=<playerToken>`. | Es el token de sesión de la plataforma LuckyBet (PHP) obtenido cuando el jugador inicia sesión en el sitio. |

---

## 2. Catálogo Detallado de Endpoints por Módulo

---

### 2.1 Módulo: `Auth` (`/api/v1.0/auth`)

#### `POST /api/v1.0/auth/login`
- **Propósito**: Autentica a un usuario administrador. Setea la cookie segura `accessToken`.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: Pública (Ninguno).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "adminUser",  // string, obligatorio, min: 3, max: 20
    "password": "miPassword"  // string, obligatorio, min: 6, max: 50
  }
  ```
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Inició sesión exitosamente",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "user": {
        "id": 1,
        "username": "adminUser",
        "role": "SUPER_ADMIN", // "SUPER_ADMIN" | "REVIEWER"
        "isActive": true
      }
    }
  }
  ```

#### `POST /api/v1.0/auth/logout`
- **Propósito**: Destruye la sesión activa del administrador limpiando la cookie `accessToken`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Sesion cerrada exitosamente"
  }
  ```

#### `GET /api/v1.0/auth/me`
- **Propósito**: Retorna la información del perfil del administrador autenticado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Success",
    "data": {
      "id": 1,
      "username": "adminUser",
      "role": "SUPER_ADMIN",
      "isActive": true
    }
  }
  ```

---

### 2.2 Módulo: `Users` (`/api/v1.0/users`)

#### `POST /api/v1.0/users`
- **Propósito**: Crea un nuevo usuario administrador.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "supervisor1", // string, min: 3, max: 20
    "password": "secretPassword123", // string, min: 6, max: 50
    "role": "REVIEWER", // "SUPER_ADMIN" | "REVIEWER"
    "isActive": true // boolean opcional, default: true
  }
  ```
- **Respuesta (`201 Created`)**:
  ```json
  {
    "status": true,
    "message": "User created successfully",
    "data": {
      "id": 2,
      "username": "supervisor1",
      "role": "REVIEWER",
      "isActive": true
    }
  }
  ```

#### `GET /api/v1.0/users`
- **Propósito**: Listado paginado de usuarios administradores.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Query Params**:
  - `take` *(number, opcional, default: 100)*: Límite por página.
  - `skip` *(number, opcional, default: 0)*: Offset.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Usuarios obtenidos exitosamente",
    "data": [
      {
        "id": 1,
        "username": "adminUser",
        "role": "SUPER_ADMIN",
        "isActive": true
      }
    ],
    "meta": {
      "total": 1,
      "totalPages": 1,
      "page": 1,
      "limit": 100,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  }
  ```

#### `GET /api/v1.0/users/:id`
- **Propósito**: Detalle de un usuario administrador.
- **Parámetros de Ruta**: `id` (integer).
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: { id, username, role, isActive } }`.

#### `PATCH /api/v1.0/users/:id`
- **Propósito**: Actualiza campos de un usuario administrador.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "adminRenombrado", // opcional
    "role": "SUPER_ADMIN",          // opcional
    "isActive": false               // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el usuario actualizado en `data`.

---

### 2.3 Módulo: `Panel` (`/api/v1.0/panel`)

#### `GET /api/v1.0/panel/games`
- **Propósito**: Catálogo completo de juegos disponibles en LuckyBet (enriquecido con imágenes y proveedores, cacheado en Redis 1 hora).
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Lista de juegos obtenida",
    "data": [
      {
        "id": "104",
        "name": "sweet_bonanza",
        "title": "Sweet Bonanza",
        "provider": "Pragmatic Play",
        "img": "https://cdn.luckybet.site/games/sweet_bonanza.png"
      }
    ]
  }
  ```

---

### 2.4 Módulo: `Players` (`/api/v1.0/players`)

#### `POST /api/v1.0/players`
- **Propósito**: Registro administrativo manual de un jugador.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "jugador123", // string, requerido
    "phone": "+584121234567", // string, opcional, max: 20
    "isActive": true,          // boolean, opcional, default: true
    "levelId": 1,              // number, opcional (por defecto asigna nivel inicial)
    "roomId": 1                // number, opcional (ID de sala base)
  }
  ```
- **Respuesta (`201 Created`)**:
  ```json
  {
    "status": true,
    "message": "Player created successfully",
    "data": {
      "id": 10,
      "username": "jugador123",
      "phone": "+584121234567",
      "isActive": true,
      "experience": 0,
      "levelId": 1,
      "level": {
        "id": 1,
        "name": "Nivel Bronce",
        "image": "https://cdn.example.com/levels/bronce.png",
        "minExperience": 0
      },
      "roomId": 1,
      "room": null
    }
  }
  ```

#### `GET /api/v1.0/players`
- **Propósito**: Listado paginado y filtrado de jugadores para administradores con ordenamiento temporal.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Query Params**:
  - `username` *(string, opcional)*: Búsqueda parcial insensible a mayúsculas/minúsculas.
  - `phone` *(string, opcional)*: Búsqueda parcial por teléfono.
  - `levelId` *(number, opcional)*: Filtrar por ID de nivel exacto.
  - `minExperience` *(number, opcional)*: Experiencia mínima (`>=`).
  - `maxExperience` *(number, opcional)*: Experiencia máxima (`<=`).
  - `roomId` *(number, opcional)*: Filtrar por ID de sala asignada.
  - `isActive` *(boolean / enum: `true` | `false`, opcional)*: Filtro por estado activo/inactivo (soporta boolean o string `"true"`/`"false"`).
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*: Orden por fecha de creación (`created_at`).
  - `take` *(number, default: 50, max: 100)*: Cantidad de registros por página.
  - `skip` *(number, default: 0)*: Offset de paginación.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Players obtenidos exitosamente",
    "data": [
      {
        "id": 10,
        "username": "jugador123",
        "phone": "+584121234567",
        "isActive": true,
        "experience": 150,
        "levelId": 1,
        "level": {
          "id": 1,
          "name": "Nivel Bronce",
          "image": "https://cdn.example.com/levels/bronce.png",
          "minExperience": 0
        },
        "roomId": 1,
        "room": {
          "id": 1,
          "name": "SalaGeneral",
          "bonus": "0",
          "isActive": true
        }
      }
    ],
    "meta": {
      "total": 1,
      "totalPages": 1,
      "page": 1,
      "limit": 50,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  }
  ```

#### `GET /api/v1.0/players/me`
- **Propósito**: Perfil del jugador autenticado. Si el jugador no existe localmente, se sincroniza en automático creando su registro y asociándole su sala real de LuckyBet.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Success",
    "data": {
      "id": 10,
      "username": "jugador123",
      "phone": null,
      "experience": 320,
      "isActive": true,
      "luckyBetId": "5043",
      "level": {
        "id": 2,
        "name": "Nivel Plata",
        "image": "https://cdn.example.com/levels/plata.png",
        "minExperience": 300
      },
      "room": {
        "id": 1,
        "name": "SalaGeneral",
        "bonus": "0",
        "isActive": true
      }
    }
  }
  ```

#### `GET /api/v1.0/players/me/last-game`
- **Propósito**: Consulta la última partida jugada o la sesión activa en LuckyBet.
- **Autenticación / Token**: **Player Token**.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Último juego obtenido exitosamente",
    "data": {
      "gameId": "sweet_bonanza",
      "gameName": "Sweet Bonanza",
      "provider": "Pragmatic Play",
      "isCurrentlyPlaying": false,
      "lastPlayedAt": "2026-09-24T18:30:00.000Z"
    }
  }
  ```

#### `GET /api/v1.0/players/me/games`
- **Propósito**: Historial deduplicado de partidas jugadas con imágenes del catálogo.
- **Autenticación / Token**: **Player Token**.
- **Query Params**:
  - `days` *(number, opcional)*: Días a consultar hacia atrás.
  - `limit` *(number, opcional)*: Límite de partidas.
  - `from` *(string ISO, opcional)*: Ej: `2026-09-01`.
  - `to` *(string ISO, opcional)*: Ej: `2026-09-24`.
  - `provider` *(string, opcional)*: Filtrar por proveedor (ej: `Pragmatic Play`).
  - `gameName` *(string, opcional)*: Filtrar por nombre de juego.
  - `forceRefresh` *(boolean, opcional)*: Saltear caché de Redis y consultar LuckyBet en vivo.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Historial de juegos obtenido exitosamente",
    "data": {
      "games": [
        {
          "gameId": "sweet_bonanza",
          "gameName": "Sweet Bonanza",
          "provider": "Pragmatic Play",
          "imageUrl": "https://cdn.luckybet.site/games/sweet_bonanza.png",
          "roundsPlayed": 15,
          "totalBet": 75.0,
          "lastPlayedAt": "2026-09-24T18:30:00.000Z"
        }
      ],
      "totalUniqueGames": 1
    }
  }
  ```

#### `GET /api/v1.0/players/:id` y `PATCH /api/v1.0/players/:id`
- **Propósito**: Consulta y edición de jugadores por administradores.
- **Autenticación**: **Admin JWT** (Cookie `accessToken`).
- **Body de Entrada para PATCH (`application/json`)**:
  ```json
  {
    "phone": "+584129999999", // opcional
    "isActive": true,          // opcional
    "levelId": 2,              // opcional
    "roomId": 3                // opcional
  }
  ```

---

### 2.5 Módulo: `Levels` (`/api/v1.0/levels`)

#### `GET /api/v1.0/levels`
- **Propósito**: Catálogo público de niveles.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública.
- **Query Params**:
  - `take` *(number, opcional, default: 100)*
  - `skip` *(number, opcional, default: 0)*
  - `name` *(string, opcional)*: Búsqueda por nombre.
  - `roomId` *(number, opcional)*: Filtrar por sala promocional.
  - `minCoins` / `maxCoins` *(number, opcional)*
  - `minExperience` / `maxExperience` *(number, opcional)*
  - `sortOrder` *(enum: `ASC` | `DESC`, default: `ASC`)*
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Niveles obtenidos exitosamente",
    "data": [
      {
        "id": 1,
        "name": "Bronce",
        "image": "https://cdn.example.com/levels/bronce.png",
        "minExperience": 0,
        "coins": 0,
        "roomId": null
      },
      {
        "id": 2,
        "name": "Plata",
        "image": "https://cdn.example.com/levels/plata.png",
        "minExperience": 500,
        "coins": 1000,
        "roomId": 5
      }
    ],
    "meta": { "total": 2, "totalPages": 1, "page": 1, "limit": 100, "hasPreviousPage": false, "hasNextPage": false }
  }
  ```

#### `GET /api/v1.0/levels/:id`
- **Propósito**: Ficha de un nivel por su ID.
- **Autenticación / Token**: Pública.
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: 
  ```json
  { 
    "status": true, 
    "message": "",
    "data": {
      "id": 3,
      "name": "Oro",
      "image": "https://cdn.example.com/levels/uuid-oro.png",
      "minExperience": 1500,
      "coins": 2500,
      "roomId": 5 
    } 
  }
  ```.

#### `POST /api/v1.0/levels`
- **Propósito**: Crea un nuevo nivel con imagen y sala promocional opcional.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, rol `SUPER_ADMIN`).
- **Campos del Formulario (`multipart/form-data`)**:
  - `name` *(string, requerido)*: Nombre del nivel (ej: `"Oro"`).
  - `minExperience` *(number, requerido)*: Puntos de experiencia requeridos (ej: `1500`).
  - `coins` *(number, requerido)*: Fichas otorgadas al ascender (ej: `2500`).
  - `roomId` *(number, opcional)*: ID de la sala con bono asociada.
  - `image` *(binary file, requerido)*: Archivo de imagen (JPEG, PNG o WebP, máx 5 MiB).
- **Respuesta (`201 Created`)**:
  ```json
  {
    "status": true,
    "message": "Nivel creado exitosamente",
    "data": {
      "id": 3,
      "name": "Oro",
      "image": "https://cdn.example.com/levels/uuid-oro.png",
      "minExperience": 1500,
      "coins": 2500,
      "roomId": 5
    }
  }
  ```

#### `PATCH /api/v1.0/levels/:id`
- **Propósito**: Actualiza campos o imagen de un nivel existente.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, rol `SUPER_ADMIN`).
- **Parámetros de Ruta**: `id` (integer).
- **Campos Opcionales (`multipart/form-data`)**: `name`, `minExperience`, `coins`, `roomId`, `image`.
- **Respuesta (`200 OK`)**: Retorna el nivel actualizado en `data`.

---

### 2.6 Módulo: `Rooms` (`/api/v1.0/rooms`)

#### `GET /api/v1.0/rooms/active`
- **Propósito**: Listado público de salas con bono disponibles.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Salas activas obtenidas exitosamente",
    "data": [
      {
        "id": 1,
        "name": "SalaGeneral",
        "bonus": "0", // "0" | "30" | "40" | "50" | "100" | "150" | "200"
        "isActive": true
      },
      {
        "id": 5,
        "name": "SalaPromo100",
        "bonus": "100",
        "isActive": true
      }
    ]
  }
  ```

#### `GET /api/v1.0/rooms`
- **Propósito**: Listado administrativo filtrado y paginado de salas.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `name` *(string, opcional)*: Búsqueda parcial insensible a mayúsculas/minúsculas.
  - `bonus` *(enum, opcional)*: `"0"` | `"30"` | `"40"` | `"50"` | `"100"` | `"150"` | `"200"`.
  - `isActive` *(boolean, opcional)*.
  - `take` *(number, default: 50)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**: Array paginado de salas con `meta`.

#### `GET /api/v1.0/rooms/:id`
- **Propósito**: Detalle de una sala por ID.
- **Autenticación / Token**: **Admin JWT**.

#### `POST /api/v1.0/rooms`
- **Propósito**: Registra una sala asociada a un senior en LuckyBet.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, rol `SUPER_ADMIN`).
- **Body de Entrada (JSON)**:
  ```json
  {
    "name": "SeniorSuperPromocional", // string, obligatorio
    "bonus": "200",                   // enum: "0"|"30"|"40"|"50"|"100"|"150"|"200"
    "isActive": true                  // boolean, opcional, default: true
  }
  ```
- **Respuesta (`201 Created`)**:
  ```json
  {
    "status": true,
    "message": "Sala creada exitosamente",
    "data": {
      "id": 6,
      "name": "SeniorSuperPromocional",
      "bonus": "200",
      "isActive": true,
      "createdAt": "2026-09-24T12:00:00.000Z",
      "updatedAt": "2026-09-24T12:00:00.000Z"
    }
  }
  ```

#### `PATCH /api/v1.0/rooms/:id` y `PATCH /api/v1.0/rooms/:id/status`
- **Propósito**: Edición de nombre/bono o activación/desactivación de la sala.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, rol `SUPER_ADMIN`).
- **Body para PATCH status**: `{ "isActive": false }`.

---

### 2.7 Módulo: `Missions` (`/api/v1.0/missions`)

#### A. Endpoints para Jugadores (Frontend Cliente)

##### `GET /api/v1.0/missions`
- **Propósito**: Catálogo de misiones disponibles para los jugadores.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública o con Player Token.
- **Query Params**: `take` (default 100), `skip` (default 0).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Misiones obtenidas exitosamente",
    "data": [
      {
        "id": 1,
        "title": "Gana 5 rondas en Pragmatic",
        "description": "Juega al menos 5 rondas con apuesta mínima de 1 USD",
        "type": "DAILY", // "DAILY" | "WEEKLY" | "FIXED"
        "status": "ACTIVE",
        "coinsAmount": 200,
        "experiencePoints": 50,
        "roomId": null,
        "imageUrl": "https://cdn.example.com/missions/mision1.png",
        "activatedAt": "2026-09-24T00:00:00.000Z",
        "expiresAt": "2026-09-25T00:00:00.000Z",
        "steps": [
          {
            "id": 10,
            "missionId": 1,
            "stepOrder": 1,
            "type": "GAME_PLAY", // "IMAGE" | "TEXT" | "GAME_PLAY"
            "content": "Juega al menos 5 rondas",
            "targetConfig": {
              "provider": "Pragmatic Play",
              "gameId": "sweet_bonanza",
              "minUniqueGames": 1
            }
          }
        ]
      }
    ],
    "meta": { "total": 1, "totalPages": 1, "page": 1, "limit": 100, "hasPreviousPage": false, "hasNextPage": false }
  }
  ```

##### `POST /api/v1.0/missions/:missionId/start`
- **Propósito**: Inicia una misión para el jugador autenticado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `missionId` (integer).
- **Respuesta (`201 Created`)**:
  ```json
  {
    "status": true,
    "message": "Mision iniciada exitosamente",
    "data": {
      "id": 15,
      "playerId": 10,
      "missionId": 1,
      "status": "IN_PROGRESS", // "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "CANCELLED"
      "currentStep": 1,
      "startedAt": "2026-09-24T14:00:00.000Z",
      "completedAt": null
    }
  }
  ```

##### `POST /api/v1.0/missions/user-missions/:userMissionId/steps/:stepId/submit`
- **Propósito**: Envía la evidencia para un paso de tipo `TEXT` o `IMAGE`. Si todos los pasos se completan, genera automáticamente el registro en `mission_rewards` con estado `PENDING`.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`). Valida pertenencia del jugador.
- **Parámetros de Ruta**: `userMissionId` (integer), `stepId` (integer).
- **Campos del Formulario (`multipart/form-data`)**:
  - `submissionText` *(string, opcional si el paso es TEXT)*: Texto ingresado por el usuario.
  - `submissionImage` *(binary file, opcional si el paso es IMAGE)*: Archivo de captura (JPEG, PNG o WebP, máx 5 MiB).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Paso enviado exitosamente",
    "data": {
      "id": 25,
      "userMissionId": 15,
      "missionStepId": 10,
      "status": "APPROVED", // "PENDING" | "APPROVED" | "REJECTED"
      "submissionText": "Usuario de prueba",
      "submissionImageUrl": "https://cdn.example.com/missions/uuid-captura.png",
      "reviewedById": null,
      "reviewedAt": null,
      "reviewerNotes": null
    }
  }
  ```

##### `POST /api/v1.0/missions/user-missions/:userMissionId/steps/:stepId/verify`
- **Propósito**: Verifica automáticamente un paso `GAME_PLAY` cruzando las partidas del jugador en LuckyBet contra los criterios de `targetConfig`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `userMissionId` (integer), `stepId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Paso automatico verificado exitosamente",
    "data": {
      "id": 26,
      "userMissionId": 15,
      "missionStepId": 11,
      "status": "APPROVED"
    }
  }
  ```

##### `GET /api/v1.0/missions/my-missions`
- **Propósito**: Misiones en curso y completadas del jugador autenticado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token**.
- **Query Params**: `take` (default 100), `skip` (default 0).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: UserMissionBasic[], meta }`.

##### `GET /api/v1.0/missions/user-missions/:userMissionId`
- **Propósito**: Progreso detallado y lista de pasos de una misión del jugador.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token**.
- **Parámetros de Ruta**: `userMissionId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Mision obtenida exitosamente",
    "data": {
      "id": 15,
      "playerId": 10,
      "missionId": 1,
      "status": "IN_PROGRESS",
      "currentStep": 2,
      "startedAt": "2026-09-24T14:00:00.000Z",
      "completedAt": null,
      "steps": [
        {
          "id": 25,
          "userMissionId": 15,
          "missionStepId": 10,
          "status": "APPROVED",
          "submissionText": "Usuario de prueba",
          "submissionImageUrl": null
        }
      ]
    }
  }
  ```

---

#### B. Endpoints Administrativos de Misiones

##### `POST /api/v1.0/missions`
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Campos del Formulario (`multipart/form-data`)**:
  - `title` *(string, requerido)*: Título de la misión.
  - `description` *(string, opcional)*: Descripción.
  - `type` *(enum, requerido)*: `"DAILY"` | `"WEEKLY"` | `"FIXED"`.
  - `coinsAmount` *(number, requerido)*: Fichas de premio.
  - `experiencePoints` *(number, requerido)*: Puntos de exp.
  - `roomId` *(number, opcional)*: ID de sala promocional.
  - `image` *(binary file, requerido)*: Imagen ilustrativa (PNG o JPEG).
  - `missionSteps` *(string JSON parseable, opcional)*:
    ```json
    [
      {
        "stepOrder": 1,
        "type": "GAME_PLAY", // "IMAGE" | "TEXT" | "GAME_PLAY"
        "content": "Juega al menos 5 rondas",
        "targetConfig": {
          "provider": "Pragmatic Play",
          "gameId": "sweet_bonanza",
          "minUniqueGames": 1
        }
      }
    ]
    ```
- **Respuesta (`201 Created`)**: Retorna la misión creada con sus pasos en `data`.

##### `GET /api/v1.0/missions/admin/review-queue`
- **Propósito**: Cola de pasos manuales pendientes de revisión humana por los administradores.
- **Autenticación**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**: `status`, `playerId`, `experience`, `coinsAmount`, `type`, `take`, `skip`.
- **Respuesta (`200 OK`)**: Retorna las misiones agrupadas por jugador con sus evidencias en `data`.

##### `POST /api/v1.0/missions/admin/steps/:stepId/review`
- **Tipo de Contenido**: `application/json`
- **Autenticación**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Parámetros de Ruta**: `stepId` (integer, ID del paso de usuario).
- **Body de Entrada (JSON)**:
  ```json
  {
    "status": "APPROVED", // "APPROVED" | "REJECTED"
    "reviewerNotes": "Comprobante verificado con éxito" // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el paso evaluado en `data`.

##### `PATCH /api/v1.0/missions/:id`
- **Tipo de Contenido**: `application/json`
- **Autenticación**: **Admin JWT**.
- **Body de Entrada (JSON)**:
  ```json
  {
    "title": "Nuevo título",       // opcional
    "description": "Nueva desc",   // opcional
    "type": "WEEKLY",              // opcional
    "status": "INACTIVE",          // opcional
    "coinsAmount": 300,            // opcional
    "roomId": 2,                   // opcional, nullable
    "experiencePoints": 80,        // opcional
    "imageUrl": "https://..."      // opcional
  }
  ```

##### `POST /api/v1.0/missions/:id/activate`
- **Propósito**: Activa una misión en estado `INACTIVE`. Fija automáticamente fecha de expiración según el tipo (`DAILY`: 24h, `WEEKLY`: 7 días).
- **Autenticación**: **Admin JWT**.

##### `POST /api/v1.0/missions/:id/image` y `DELETE /api/v1.0/missions/:id/image`
- **Propósito**: Reemplazo o eliminación de la imagen de la misión.
- **POST Content-Type**: `multipart/form-data` con campo `file`.
- **Autenticación**: **Admin JWT**.

---

### 2.8 Módulo: `Rewards` (`/api/v1.0/rewards`)

#### `GET /api/v1.0/rewards/my-pending`
- **Propósito**: Lista las recompensas de misiones completadas que están pendientes por ser cobradas por el jugador autenticado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Recompensas pendientes obtenidas exitosamente",
    "data": [
      {
        "id": 8,
        "userMissionId": 15,
        "playerId": 10,
        "coinsAmount": 500,
        "experiencePoints": 100,
        "roomId": 3,
        "status": "PENDING", // "PENDING" | "PROCESSING" | "CLAIMED" | "TIMEOUT_UNCERTAIN"
        "claimedAt": null
      }
    ]
  }
  ```

#### `POST /api/v1.0/rewards/user-missions/:userMissionId/claim`
- **Propósito**: Reclama las fichas de una misión completada.
- **Protocolo en Backend**:
  1. Adquiere lock en BD pasando a `PROCESSING`.
  2. Si tiene sala promocional, transfiere temporalmente al jugador a esa sala en LuckyBet. Si falla -> `TIMEOUT_UNCERTAIN`.
  3. Acredita las fichas (`creditPlayer`). Si da timeout -> `TIMEOUT_UNCERTAIN`.
  4. Retorna obligatoriamente al jugador a su sala base. Si falla la vuelta -> `TIMEOUT_UNCERTAIN`.
  5. Éxito total -> `CLAIMED`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `userMissionId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Recompensa reclamada exitosamente",
    "data": {
      "id": 8,
      "userMissionId": 15,
      "playerId": 10,
      "coinsAmount": 500,
      "roomId": 3,
      "experiencePoints": 100,
      "status": "CLAIMED",
      "externalOperationId": "op_987214",
      "errorMessage": null,
      "claimedAt": "2026-09-24T14:32:00.000Z"
    }
  }
  ```

#### `GET /api/v1.0/rewards/admin/uncertain` y `POST /api/v1.0/rewards/admin/:rewardId/resolve`
- **Propósito**: Auditoría administrativa de reclamos dudosos.
- **Autenticación**: **Admin JWT** (Cookie `accessToken`, rol `SUPER_ADMIN`).
- **Body para Resolve (`application/json`)**:
  ```json
  {
    "action": "RESOLVE_CLAIMED", // "RESOLVE_CLAIMED" | "FORCE_RETRY"
    "externalOperationId": "op_12345", // opcional
    "adminNotes": "Confirmado en reporte diario de LuckyBet" // opcional
  }
  ```

---

### 2.9 Módulo: `Chests` (`/api/v1.0/chests`)

Catálogo administrativo de cofres semanales y mensuales.

#### `GET /api/v1.0/chests`
- **Autenticación**: **Admin JWT**.
- **Query Params**: `take`, `skip`, `periodType` (`WEEKLY` | `MONTHLY`), `isActive`.
- **Respuesta (`200 OK`)**: Array paginado de cofres configurados con `requiredMissions`, `coinsAmount`, `experiencePoints`, `roomId`.

#### `POST /api/v1.0/chests`
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Campos del Formulario (`multipart/form-data`)**:
  - `title` *(string, requerido)*: Título del cofre.
  - `description` *(string, opcional)*: Descripción.
  - `periodType` *(enum, requerido)*: `"WEEKLY"` | `"MONTHLY"`.
  - `requiredMissions` *(number, requerido)*: Misiones mínimas requeridas en el periodo.
  - `coinsAmount` *(number, requerido)*: Fichas otorgadas.
  - `experiencePoints` *(number, requerido)*: Puntos de exp otorgados.
  - `roomId` *(number, opcional)*: ID de sala promocional.
  - `isActive` *(boolean, opcional, default: true)*.
  - `image` *(binary file, opcional)*: Archivo de imagen (PNG o JPEG).
- **Respuesta (`201 Created`)**: Retorna el cofre creado en `data`.

#### `PATCH /api/v1.0/chests/:id`
- **Tipo de Contenido**: `application/json`
- **Autenticación**: **Admin JWT**.
- **Body de Entrada (JSON)**: Campos opcionales (`title`, `description`, `periodType`, `requiredMissions`, `coinsAmount`, `roomId`, `experiencePoints`, `isActive`).

#### `POST /api/v1.0/chests/:id/image` y `DELETE /api/v1.0/chests/:id/image`
- **Propósito**: Sube/reemplaza o elimina la imagen del cofre.
- **POST Content-Type**: `multipart/form-data` con campo `file`.
- **Autenticación**: **Admin JWT**.

---

### 2.10 Módulo: `PlayerChests` (`/api/v1.0/player-chests`)

#### `GET /api/v1.0/player-chests/progress`
- **Propósito**: Calcula el progreso en vivo de **todos los cofres activos** en el periodo vigente (semana o mes actual) para el jugador autenticado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Progreso de cofres obtenido exitosamente",
    "data": [
      {
        "chest": {
          "id": 1,
          "title": "Cofre Semanal de Bronce",
          "description": "Completa 5 misiones esta semana",
          "periodType": "WEEKLY",
          "requiredMissions": 5,
          "coinsAmount": 500,
          "roomId": 2,
          "experiencePoints": 100,
          "imageUrl": "https://cdn.example.com/chests/semanal.png",
          "isActive": true
        },
        "periodKey": "2026-W39",
        "completedMissions": 3,
        "requiredMissions": 5,
        "state": "LOCKED", // "LOCKED" | "UNLOCKED" | "CLAIMED" | "TIMEOUT_UNCERTAIN"
        "claimedAt": null
      }
    ]
  }
  ```

#### `GET /api/v1.0/player-chests/:chestId/progress`
- **Propósito**: Progreso de un cofre individual en el periodo actual.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `chestId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Progreso de cofre obtenido exitosamente",
    "data": {
      "chest": {
        "id": 1,
        "title": "Cofre Semanal de Bronce",
        "periodType": "WEEKLY",
        "requiredMissions": 5,
        "coinsAmount": 500,
        "roomId": 2,
        "experiencePoints": 100,
        "imageUrl": "https://cdn.example.com/chests/semanal.png",
        "isActive": true
      },
      "periodKey": "2026-W39",
      "completedMissions": 5,
      "requiredMissions": 5,
      "state": "UNLOCKED",
      "claimedAt": null
    }
  }
  ```

#### `POST /api/v1.0/player-chests/:chestId/join`
- **Propósito**: Inscribe la participación del jugador en el cofre del periodo actual en estado `PENDING`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `chestId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Participación en el cofre registrada exitosamente",
    "data": {
      "id": 14,
      "playerId": 10,
      "chestId": 1,
      "periodKey": "2026-W39",
      "completedMissionsCount": 2,
      "coinsAmount": 500,
      "roomId": 2,
      "status": "PENDING",
      "externalOperationId": null,
      "errorMessage": null,
      "resolvedByAdminId": null,
      "claimedAt": null
    }
  }
  ```

#### `GET /api/v1.0/player-chests`
- **Propósito**: Historial paginado de cofres del jugador autenticado con ordenamiento y filtros.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `chestId` *(number, opcional)*: Filtrar por cofre.
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`.
  - `periodKey` *(string, opcional)*: Ej: `"2026-W39"` o `"2026-09"`.
  - `orderBy` *(enum, default: `created_at`)*: `"created_at"` | `"periodKey"` | `"id"`.
  - `orderDirection` *(enum, default: `DESC`)*: `"ASC"` | `"DESC"`.
  - `take` *(number, default: 50)*: Registros por página.
  - `skip` *(number, default: 0)*: Offset.
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: UserMissionChestBasic[], meta }`.

#### `POST /api/v1.0/player-chests/:chestId/claim`
- **Propósito**: Reclamo atómico de fichas y experiencia de un cofre desbloqueado en el periodo actual.
- **Protocolo en Backend**:
  1. Valida que `completedMissions >= requiredMissions` en el rango de fechas.
  2. Adquiere lock en BD pasando a `PROCESSING` con restricción `UNIQUE(playerId, chestId, periodKey)`.
  3. Acredita experiencia e incrementa nivel si aplica (sin tocar la sala base permanente).
  4. Si tiene sala asociada, transfiere temporalmente al jugador a esa sala en LuckyBet.
  5. Carga fichas en LuckyBet (`creditPlayer`).
  6. Regresa al jugador obligatoriamente a su sala base. Si falla la vuelta -> `TIMEOUT_UNCERTAIN`.
  7. Éxito total -> `CLAIMED`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `chestId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Cofre reclamado exitosamente",
    "data": {
      "id": 14,
      "playerId": 10,
      "chestId": 1,
      "periodKey": "2026-W39",
      "completedMissionsCount": 5,
      "coinsAmount": 500,
      "roomId": 2,
      "status": "CLAIMED",
      "externalOperationId": "op_chest_543",
      "errorMessage": null,
      "resolvedByAdminId": null,
      "claimedAt": "2026-09-24T15:00:00.000Z"
    }
  }
  ```

#### Endpoints Administrativos de Cofres de Jugadores
- `GET /api/v1.0/player-chests/admin/uncertain`: Lista reclamos inciertos de cofres.
- `POST /api/v1.0/player-chests/admin/:claimId/resolve`:
  - `Body`: `{ "action": "RESOLVE_CLAIMED" | "FORCE_RETRY", "externalOperationId?": string, "adminNotes?": string }`.

---

### 2.11 Módulo: `LevelRewards` (`/api/v1.0/level-rewards`)

#### `GET /api/v1.0/level-rewards`
- **Propósito**: Historial de recompensas por ascenso de nivel del jugador autenticado. Permite consultar pendientes pasando `?status=PENDING`, filtrar por nivel y ordenar en ambas direcciones.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`.
  - `levelId` *(number, opcional)*: Filtrar por nivel.
  - `orderBy` *(enum, default: `created_at`)*: `"created_at"` | `"levelId"` | `"id"`.
  - `orderDirection` *(enum, default: `DESC`)*: `"ASC"` | `"DESC"`.
  - `take` *(number, default: 50)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Historial de recompensas de nivel obtenido exitosamente",
    "data": [
      {
        "id": 3,
        "playerId": 10,
        "levelId": 2,
        "coinsAmount": 1000,
        "roomId": 5,
        "status": "PENDING",
        "externalOperationId": null,
        "errorMessage": null,
        "resolvedByAdminId": null,
        "claimedAt": null,
        "createdAt": "2026-09-24T12:00:00.000Z",
        "updatedAt": "2026-09-24T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "totalPages": 1,
      "page": 1,
      "limit": 50,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  }
  ```

#### `POST /api/v1.0/level-rewards/:levelId/claim`
- **Propósito**: Reclamo voluntario del premio otorgado por alcanzar un nivel.
- **Protocolo en Backend**:
  1. Valida que el jugador haya alcanzado el nivel (`player.levelId >= levelId`).
  2. Adquiere lock atómico en `level_rewards` pasando a `PROCESSING` con restricción `UNIQUE(playerId, levelId)`.
  3. Si el nivel tiene una sala asignada (`roomId`), transfiere temporalmente al jugador a esa sala en LuckyBet.
  4. Carga las fichas en LuckyBet (`creditPlayer`).
  5. Retorna obligatoriamente al jugador a su sala base. Si falla el retorno, pasa a `TIMEOUT_UNCERTAIN` sin tocar la sala permanente.
  6. Éxito total -> `CLAIMED`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `levelId` (integer).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Premio de nivel reclamado exitosamente",
    "data": {
      "id": 3,
      "playerId": 10,
      "levelId": 2,
      "coinsAmount": 1000,
      "roomId": 5,
      "status": "CLAIMED",
      "externalOperationId": "op_level_882",
      "errorMessage": null,
      "resolvedByAdminId": null,
      "claimedAt": "2026-09-24T15:20:00.000Z",
      "createdAt": "2026-09-24T12:00:00.000Z",
      "updatedAt": "2026-09-24T15:20:00.000Z"
    }
  }
  ```

#### Endpoints Administrativos de Recompensas de Nivel
- `GET /api/v1.0/level-rewards/admin/uncertain`: Lista reclamos inciertos de nivel.
- `POST /api/v1.0/level-rewards/admin/:claimId/resolve`:
  - `Body`: `{ "action": "RESOLVE_CLAIMED" | "FORCE_RETRY", "externalOperationId?": string, "adminNotes?": string }`.

---

### 2.12 Módulo: `Health` (`/api/v1.0/health`)

#### `GET /api/v1.0/health`
- **Propósito**: Verificación de salud y disponibilidad del servicio (Liveness probe).
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Service is running"
  }
  ```
