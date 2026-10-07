# Especificación de Integración de la API (Frontend / Clientes)

> Guía exhaustiva y técnica para el equipo de frontend y clientes API. Contiene **todos** los endpoints de los 14 módulos del sistema, sus métodos HTTP, cabeceras requeridas, tokens de autorización, formato de contenido (`application/json` vs `multipart/form-data`) y los esquemas literales de JSON completos para cada petición (Request Body / Query Params) y respuesta (Response Body).

---

## 1. Convenciones Globales y Autenticación

### 1.1 Formato Estándar de Respuesta

Todos los endpoints del backend responden bajo una de estas dos estructuras estándar:

#### A. Respuesta Simple (`apiResponseSchema`)
```json
{
  "status": true,
  "message": "Mensaje descriptivo del resultado",
  "data": { ... } // Objeto del recurso solicitado
}
```

#### B. Respuesta Paginada (`paginatedResponseSchema`)
```json
{
  "status": true,
  "message": "Mensaje descriptivo del resultado",
  "data": [ ... ], // Arreglo de elementos paginados
  "meta": {
    "total": 120,        // Total global de registros que cumplen los filtros
    "totalPages": 3,     // Total de páginas calculadas
    "page": 1,           // Página actual (1-indexed)
    "limit": 50,         // Registros por página solicitados (take)
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

Existen **dos universos de tokens completamente independientes** según el rol del cliente:

| Tipo de Token | ¿Quién lo usa? | Tipo de Cabecera / Transporte | Cómo se obtiene |
| :--- | :--- | :--- | :--- |
| **Admin JWT** | Administradores (`SUPER_ADMIN`, `REVIEWER`) | **Cookie HTTP-only** llamada `accessToken` enviada automáticamente por el navegador en cada request (`credentials: 'include'` en `fetch` o `withCredentials: true` en `axios`). | Al llamar a `POST /api/v1.0/auth/login`. |
| **Player Token** | Jugadores finales de LuckyBet | **Header HTTP**: `Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`. Alternativamente vía query param: `?token=<playerToken>`. | Es el token de sesión emitido por la plataforma LuckyBet (PHP) al iniciar sesión el jugador. |
| **Público** | Cualquier cliente | Ninguno. | Rutas de catálogo y salud (`/health`, `/panel/games`, `/panel/providers`, `/rooms/active`, `/levels`). |

---

## 2. Catálogo Detallado de Endpoints por Módulo

---

### 2.1 Módulo: `Auth` (`/api/v1.0/auth`)

Controlador: `AuthController`

#### `POST /api/v1.0/auth/login`
- **Propósito**: Autentica a un usuario administrador. Setea la cookie segura HTTP-only `accessToken`.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: Pública (Ninguno).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "adminUser",  // string, obligatorio, min: 3, max: 20
    "password": "secretPassword123" // string, obligatorio, min: 6, max: 50
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
- **Propósito**: Cierra la sesión activa del administrador limpiando la cookie `accessToken`.
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

Controlador: `UsersController`

#### `POST /api/v1.0/users`
- **Propósito**: Registra un nuevo usuario con permisos administrativos.
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
- **Propósito**: Consulta un administrador por su ID.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: { id, username, role, isActive } }`.

#### `PATCH /api/v1.0/users/:id`
- **Propósito**: Actualiza campos de un usuario administrador.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "username": "adminRenombrado", // string, opcional
    "role": "SUPER_ADMIN",          // enum: "SUPER_ADMIN" | "REVIEWER", opcional
    "isActive": false               // boolean, opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el usuario actualizado en `data`.

---

### 2.3 Módulo: `Panel` (`/api/v1.0/panel`)

Controlador: `PanelController`

#### `GET /api/v1.0/panel/games`
- **Propósito**: Catálogo completo de juegos disponibles en LuckyBet (enriquecido con imágenes y proveedores, obtenido mediante `siteInitialize` con `before_token` y cacheado en Redis por 24 horas).
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública (No requiere sesión ni token de jugador).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Lista de juegos obtenida",
    "data": [
      {
        "id": 104,
        "name": "sweet_bonanza",
        "title": "Sweet Bonanza",
        "provider": "Pragmatic Play",
        "label": "Pragmatic Play",
        "img": "/resources/sitepics/games/sweet_bonanza.png",
        "category": "slots",
        "type": "html5",
        "bonus": "1"
      }
    ]
  }
  ```

#### `GET /api/v1.0/panel/providers`
- **Propósito**: Lista deduplicada y ordenada alfabéticamente de proveedores de juegos en LuckyBet (extraídos a partir del campo `label` del catálogo de juegos) con almacenamiento y caché en Redis por 24 horas.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública (No requiere sesión ni token de jugador).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Lista de proveedores obtenida exitosamente",
    "data": [
      {
        "name": "Amusnet",
        "slug": "amusnet"
      },
      {
        "name": "Betsoft",
        "slug": "betsoft"
      },
      {
        "name": "Pragmatic Play",
        "slug": "pragmatic-play"
      }
    ]
  }
  ```

---

### 2.4 Módulo: `Players` (`/api/v1.0/players`)

Controlador: `PlayersController`

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
  - `username` *(string, opcional)*: Búsqueda parcial insensible a mayúsculas/minúsculas (`ILike`).
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
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
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
- **Propósito**: Historial deduplicado de partidas jugadas en LuckyBet, enriquecido con imágenes del catálogo.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `days` *(number, opcional)*: Días a consultar hacia atrás (default: 7).
  - `limit` *(number, opcional)*: Límite de partidas (default: 10).
  - `from` *(string ISO, opcional)*: Ej: `"2026-09-01"`.
  - `to` *(string ISO, opcional)*: Ej: `"2026-09-24"`.
  - `provider` *(string, opcional)*: Filtrar por proveedor.
  - `gameName` *(string, opcional)*: Filtrar por nombre del juego.
  - `forceRefresh` *(boolean, opcional)*: Saltear caché de Redis y consultar LuckyBet en vivo.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Historial de juegos obtenido exitosamente",
    "data": {
      "userId": 10,
      "periodDays": 7,
      "from": "2026-09-17",
      "to": "2026-09-24",
      "games": [
        {
          "gameId": "sweet_bonanza",
          "gameName": "Sweet Bonanza",
          "provider": "Pragmatic Play",
          "imageUrl": "https://cdn.luckybet.site/games/sweet_bonanza.png",
          "lastPlayedAt": "2026-09-24 18:30:00",
          "totalBetInPeriod": 75.0,
          "playCount": 15
        }
      ],
      "totalUniqueGames": 1
    }
  }
  ```

#### `GET /api/v1.0/players/:id`
- **Propósito**: Obtiene un jugador por su ID interno.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: PlayerResponseDto }`.

#### `PATCH /api/v1.0/players/:id`
- **Propósito**: Actualiza datos de un jugador (teléfono, sala, nivel, estado activo).
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "phone": "+584129999999", // string, opcional, nullable
    "isActive": true,          // boolean, opcional
    "levelId": 2,              // number, opcional, nullable
    "roomId": 3                // number, opcional, nullable
  }
  ```
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: PlayerResponseDto }`.

---

### 2.5 Módulo: `Levels` (`/api/v1.0/levels`)

Controlador: `LevelsController`

#### `GET /api/v1.0/levels`
- **Propósito**: Catálogo público de niveles ordenados por experiencia mínima.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública.
- **Query Params**:
  - `take` *(number, opcional, default: 100)*
  - `skip` *(number, opcional, default: 0)*
  - `name` *(string, opcional)*: Búsqueda por nombre.
  - `roomId` *(number, opcional)*: Filtrar por sala promocional.
  - `minCoins` / `maxCoins` *(number, opcional)*
  - `minExperience` / `maxExperience` *(number, opcional)*
  - `sortOrder` *(enum: `"ASC"` | `"DESC"`, default: `"ASC"`)*
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
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: LevelResponseDto }`.

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

Controlador: `RoomsController`

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
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `name` *(string, opcional)*: Búsqueda parcial.
  - `bonus` *(enum, opcional)*: `"0"` | `"30"` | `"40"` | `"50"` | `"100"` | `"150"` | `"200"`.
  - `isActive` *(boolean, opcional)*.
  - `take` *(number, default: 50, max: 100)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**: Retorna arreglo paginado de salas con `meta`.

#### `GET /api/v1.0/rooms/:id`
- **Propósito**: Detalle de una sala por ID.
- **Autenticación / Token**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: RoomResponseDto }`.

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

#### `PATCH /api/v1.0/rooms/:id`
- **Propósito**: Actualiza nombre o porcentaje de bono de una sala.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (rol `SUPER_ADMIN`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "name": "SeniorNombreNuevo", // string, opcional
    "bonus": "150"              // enum, opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna la sala actualizada en `data`.

#### `PATCH /api/v1.0/rooms/:id/status`
- **Propósito**: Activa o desactiva la disponibilidad de la sala.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (rol `SUPER_ADMIN`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "isActive": false
  }
  ```
- **Respuesta (`200 OK`)**: Retorna la sala actualizada en `data`.

---

### 2.7 Módulo: `Missions` (`/api/v1.0/missions`)

Controladores: `MissionsController` (Administración) y `PlayerMisionesController` (Jugadores)

#### A. Endpoints para Jugadores

##### `GET /api/v1.0/missions`
- **Propósito**: Catálogo filtrado y paginado de misiones disponibles con ordenamiento cronológico.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública o con Player Token / Cookie Admin.
- **Query Params**:
  - `title` *(string, opcional)*: Búsqueda parcial (`ILike`).
  - `type` *(enum: `"DAILY"` | `"WEEKLY"` | `"FIXED"`, opcional)*.
  - `status` *(enum: `"INACTIVE"` | `"ACTIVE"` | `"COMPLETED"` | `"CANCELLED"`, opcional)*.
  - `roomId` *(number, opcional)*: Filtrar por sala promocional asignada.
  - `minCoins` / `maxCoins` *(number, opcional)*: Rango de monedas.
  - `minExperience` / `maxExperience` *(number, opcional)*: Rango de experiencia.
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*: Orden por `created_at`.
  - `take` *(number, default: 50, max: 100)*: Límite por página.
  - `skip` *(number, default: 0)*: Offset.
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
        "type": "DAILY",
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
              "minUniqueGames": 1,
              "minBet": 1
            }
          }
        ]
      }
    ],
    "meta": { "total": 1, "totalPages": 1, "page": 1, "limit": 50, "hasPreviousPage": false, "hasNextPage": false }
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
      "status": "IN_PROGRESS",
      "currentStep": 1,
      "startedAt": "2026-09-24T14:00:00.000Z",
      "completedAt": null
    }
  }
  ```

##### `POST /api/v1.0/missions/user-missions/:userMissionId/steps/:stepId/submit`
- **Propósito**: Envía o reenvía la evidencia manual para un paso de tipo `TEXT` o `IMAGE`. No bloquea al usuario por orden secuencial estricto, permitiendo enviar evidencias a su propio ritmo mientras la misión esté `IN_PROGRESS`.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Parámetros de Ruta**: `userMissionId` (integer), `stepId` (integer).
- **Campos del Formulario (`multipart/form-data`)**:
  - `submissionText` *(string, obligatorio si el paso es TEXT)*: Texto ingresado como evidencia.
  - `submissionImage` *(binary file, obligatorio si el paso es IMAGE)*: Captura de pantalla o comprobante (JPEG, PNG o WebP, máx 5 MiB).
- **Reglas de Negocio y Ciclo de Vida**:
  1. **Disponibilidad para modificación**:
     - **Sin sumisión previa**: Crea la sumisión en estado `PENDING`.
     - **Estado `PENDING` o `REJECTED`**: Permite corregir o actualizar la evidencia. El estado se fija en `PENDING` para una nueva revisión administrativa.
     - **Estado `APPROVED`**: Bloqueado contra modificaciones (`400 Bad Request: Este paso ya ha sido aprobado y no puede modificarse`).
  2. **Limpieza automática de almacenamiento**: Si se reenvía una nueva imagen en un paso que ya poseía una imagen previa almacenada en S3/Cloudflare R2, el sistema elimina automáticamente la imagen vieja para evitar archivos huérfanos.
  3. **Preservación del feedback de moderación**: Durante correcciones o reenvíos, las notas del revisor anterior (`reviewerNotes`, `reviewedById`, `reviewedAt`) se preservan en la entidad para que el jugador y el moderador mantengan el contexto hasta la nueva evaluación.
  4. **Contador de progreso (`currentStep`)**: Representa la cantidad de pasos aprobados de la misión (inicia en 0). No avanza con el simple envío en `PENDING`, sino al ser aprobado por un administrador o por el sistema. Cuando `currentStep >= totalSteps`, la misión se completa automáticamente y se genera la recompensa.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Paso enviado exitosamente",
    "data": {
      "id": 25,
      "userMissionId": 15,
      "missionStepId": 10,
      "status": "PENDING",
      "submissionText": "Comprobante actualizado",
      "submissionImageUrl": "https://cdn.example.com/steps/uuid-captura.png",
      "reviewedById": 2,
      "reviewedAt": "2026-09-24T14:30:00.000Z",
      "reviewerNotes": "Por favor sube una captura donde se aprecie claramente la fecha"
    }
  }
  ```

##### `POST /api/v1.0/missions/user-missions/:userMissionId/steps/:stepId/verify`
- **Propósito**: Verifica automáticamente un paso `GAME_PLAY` consultando el historial de juego del usuario en LuckyBet.
- **Reglas de Validación**:
  1. Calcula la ventana de tiempo en días transcurridos desde que el jugador inició la misión (`userMission.startedAt`).
  2. Determina los juegos únicos requeridos (`requiredUniqueGames`): si se fijó un `gameId`, la meta es estrictamente **1**; si se fijó un `provider`, la meta es `targetConfig.minUniqueGames ?? 1`.
  3. Comprueba que cada juego único califique con la apuesta mínima requerida (`totalBetInPeriod >= minBet`).
  4. Si `qualifyingGames.length < requiredUniqueGames`, rechaza la verificación explicando cuántos juegos calificaron y cuántos faltan.
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
- **Propósito**: Misiones en las que está participando o ha participado el jugador autenticado, con soporte de filtros y ordenamiento.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `status` *(enum: `"IN_PROGRESS"` | `"COMPLETED"` | `"EXPIRED"` | `"CANCELLED"`, opcional)*.
  - `missionId` *(number, opcional)*: Filtrar por ID de plantilla de misión.
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*: Orden por fecha de creación (`created_at`).
  - `take` *(number, default: 50, max: 100)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**: Retorna arreglo paginado de `userMissionSchema` con `meta`.

##### `GET /api/v1.0/missions/user-missions/:userMissionId`
- **Propósito**: Progreso detallado y lista de pasos de una misión del jugador.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token**.
- **Parámetros de Ruta**: `userMissionId` (integer).
- **Respuesta (`200 OK`)**: Retorna la misión de usuario con el arreglo de sus pasos y URLs públicas de las evidencias en `data`.

---

#### B. Endpoints Administrativos de Misiones

##### `POST /api/v1.0/missions`
- **Propósito**: Crea una nueva plantilla de misión con pasos de verificación.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Campos del Formulario (`multipart/form-data`)**:
  - `title` *(string, requerido)*: Título.
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
        "content": "Juega al menos a 2 juegos distintos de Pragmatic",
        "targetConfig": {
          "provider": "Pragmatic Play",
          "minUniqueGames": 2,
          "minBet": 5
        }
      }
    ]
    ```
- **Respuesta (`201 Created`)**: Retorna la misión creada con sus pasos en `data`.

##### `GET /api/v1.0/missions/admin/review-queue`
- **Propósito**: Cola de misiones de usuario pendientes de revisión humana por los administradores. Retorna una lista plana paginada en base de datos.
- **Autenticación**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `status` *(enum: `"IN_PROGRESS"` | `"COMPLETED"` | `"FAILED"` | `"EXPIRED"`, opcional)*: Filtra por estado de la misión de usuario.
  - `playerId` *(number, opcional)*: Filtrar por ID de jugador.
  - `minExperience` *(number, opcional)*: Experiencia mínima de la misión (>=).
  - `maxExperience` *(number, opcional)*: Experiencia máxima de la misión (<=).
  - `minCoinsAmount` *(number, opcional)*: Monedas mínimas de la misión (>=).
  - `maxCoinsAmount` *(number, opcional)*: Monedas máximas de la misión (<=).
  - `type` *(enum: `"DAILY"` | `"WEEKLY"` | `"FIXED"`, opcional)*: Tipo de misión.
  - `take` *(number, default: 100)*: Cantidad de registros por página.
  - `skip` *(number, default: 0)*: Desplazamiento / Offset.
- **Respuesta (`200 OK`)**: Retorna lista plana de misiones de usuario paginada con metadata de paginación (`skip`, `limit`, `total`). Cada ítem incluye:
  - `userMissionId` *(number)*
  - `playerId` *(number)*
  - `playerName` *(string, opcional)*
  - `missionId` *(number)*
  - `missionTitle` *(string)*
  - `missionDescription` *(string, opcional)*
  - `missionType` *(string)*
  - `coinsAmount` *(number)*
  - `experiencePoints` *(number)*
  - `userMissionStatus` *(string)*
  - `imageUrl` *(string, opcional)*: URL pública resuelta
  - `steps` *(array)*: Lista de pasos con evidencias y notas de revisión

##### `POST /api/v1.0/missions/admin/steps/:stepId/review`
- **Propósito**: Aprueba o rechaza la evidencia manual enviada por un jugador.
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

##### `GET /api/v1.0/missions/:id`
- **Propósito**: Obtiene una plantilla de misión por su ID.
- **Autenticación**: Pública / Admin JWT.
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: MissionResponseDto }`.

##### `PATCH /api/v1.0/missions/:id`
- **Propósito**: Actualiza la configuración de una misión y/o reemplaza atómicamente sus pasos. Solo permitido si la misión se encuentra en estado `INACTIVE`. (Las imágenes se modifican exclusivamente en los endpoints dedicados de imagen).
- **Tipo de Contenido**: `application/json`
- **Autenticación**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "title": "Misión actualizada",       // string, opcional
    "description": "Nueva descripción",  // string, opcional
    "type": "WEEKLY",                    // enum: "DAILY"|"WEEKLY"|"FIXED", opcional
    "status": "INACTIVE",                // enum: "INACTIVE"|"ACTIVE"|"COMPLETED"|"CANCELLED", opcional
    "coinsAmount": 350,                  // number, opcional
    "roomId": 2,                         // number, opcional, nullable
    "experiencePoints": 120,             // number, opcional
    "missionSteps": [                    // array de pasos, opcional (reemplaza todos los pasos de forma atómica)
      {
        "stepOrder": 1,
        "type": "GAME_PLAY",             // "IMAGE" | "TEXT" | "GAME_PLAY"
        "content": "Juega al menos a 2 juegos distintos de Pragmatic",
        "targetConfig": {
          "provider": "Pragmatic Play",
          "minUniqueGames": 2,
          "minBet": 5
        }
      }
    ]
  }
  ```
- **Respuesta (`200 OK`)**: Retorna la plantilla de misión actualizada en `data`.

##### `POST /api/v1.0/missions/:id/activate`
- **Propósito**: Activa una misión en estado `INACTIVE`. Fija automáticamente fecha de expiración según el tipo (`DAILY`: 24h, `WEEKLY`: 7 días).
- **Autenticación**: **Admin JWT**.
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna la misión activada en `data`.

##### `PATCH /api/v1.0/missions/:id/status`
- **Propósito**: Modifica el estado de una misión (`ACTIVE`, `INACTIVE`, `COMPLETED`, `CANCELLED`).
- **Tipo de Contenido**: `application/json`
- **Autenticación**: **Admin JWT**.
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "status": "COMPLETED"
  }
  ```
- **Respuesta (`200 OK`)**: Retorna la misión actualizada en `data`.

##### `POST /api/v1.0/missions/:id/image` y `DELETE /api/v1.0/missions/:id/image`
- **Propósito**: Reemplazo o eliminación de la imagen de la misión.
- **POST Content-Type**: `multipart/form-data` con campo `file` (binary).
- **Autenticación**: **Admin JWT**.

---

### 2.8 Módulo: `Rewards` (`/api/v1.0/rewards`)

Controlador: `RewardsController`

#### `GET /api/v1.0/rewards`
- **Propósito**: Historial y recompensas de misiones del jugador autenticado. Permite consultar pendientes pasando `?status=PENDING`, filtrar por misión y ordenar cronológicamente.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `status` *(enum: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`, opcional)*
  - `userMissionId` *(number, opcional)*: Filtrar por ID de misión de usuario.
  - `orderBy` *(enum: `"created_at"` | `"id"`, default: `"created_at"`)*
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*
  - `take` *(number, default: 50, max: 100)*: Registros por página.
  - `skip` *(number, default: 0)*: Offset.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Recompensas obtenidas exitosamente",
    "data": [
      {
        "id": 8,
        "userMissionId": 15,
        "playerId": 10,
        "coinsAmount": 500,
        "roomId": 3,
        "experiencePoints": 100,
        "status": "PENDING",
        "externalOperationId": null,
        "errorMessage": null,
        "resolvedByAdminId": null,
        "claimedAt": null,
        "createdAt": "2026-09-24T12:00:00.000Z"
      }
    ],
    "meta": { "total": 1, "totalPages": 1, "page": 1, "limit": 50, "hasPreviousPage": false, "hasNextPage": false }
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

#### `GET /api/v1.0/rewards/admin`
- **Propósito**: Listado general administrativo de todas las recompensas de misiones con filtros completos. Para consultar reclamos en estado incierto, pasar `?status=TIMEOUT_UNCERTAIN`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`.
  - `playerId` *(number, opcional)*: Filtrar por jugador.
  - `userMissionId` *(number, opcional)*: Filtrar por misión.
  - `orderBy` *(enum: `"created_at"` | `"id"`, default: `"created_at"`)*.
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*.
  - `take` *(number, default: 50, max: 100)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**: Retorna arreglo paginado con `meta`.

#### `POST /api/v1.0/rewards/admin/:rewardId/resolve`
- **Propósito**: Resuelve administrativamente un reclamo incierto (`RESOLVE_CLAIMED` o `FORCE_RETRY`).
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Parámetros de Ruta**: `rewardId` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "action": "RESOLVE_CLAIMED", // "RESOLVE_CLAIMED" | "FORCE_RETRY"
    "externalOperationId": "op_12345", // opcional
    "adminNotes": "Confirmado en reporte diario de LuckyBet" // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna la recompensa resuelta en `data`.

---

### 2.9 Módulo: `Chests` (`/api/v1.0/chests`)

Controlador: `ChestsController`

#### `GET /api/v1.0/chests`
- **Propósito**: Listado administrativo filtrado y paginado del catálogo de cofres.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `title` *(string, opcional)*: Búsqueda por título.
  - `periodType` *(enum: `"WEEKLY"` | `"MONTHLY"`, opcional)*.
  - `isActive` *(boolean, opcional)*.
  - `take` *(number, default: 50, max: 100)*.
  - `skip` *(number, default: 0)*.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Listado de cofres obtenido exitosamente",
    "data": [
      {
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
      }
    ],
    "meta": { "total": 1, "totalPages": 1, "page": 1, "limit": 50, "hasPreviousPage": false, "hasNextPage": false }
  }
  ```

#### `GET /api/v1.0/chests/:id`
- **Propósito**: Ficha de un cofre por ID.
- **Autenticación / Token**: **Admin JWT**.
- **Parámetros de Ruta**: `id` (integer).
- **Respuesta (`200 OK`)**: Retorna `{ status, message, data: ChestResponseDto }`.

#### `POST /api/v1.0/chests`
- **Propósito**: Crea un nuevo cofre con meta de misiones.
- **Tipo de Contenido**: `multipart/form-data`
- **Autenticación / Token**: **Admin JWT** (roles `SUPER_ADMIN` o `REVIEWER`).
- **Campos del Formulario (`multipart/form-data`)**:
  - `title` *(string, requerido)*: Título del cofre.
  - `description` *(string, opcional)*: Descripción.
  - `periodType` *(enum, requerido)*: `"WEEKLY"` | `"MONTHLY"`.
  - `requiredMissions` *(number, requerido)*: Misiones mínimas requeridas.
  - `coinsAmount` *(number, requerido)*: Fichas otorgadas.
  - `experiencePoints` *(number, requerido)*: Puntos de exp otorgados.
  - `roomId` *(number, opcional)*: ID de sala promocional.
  - `isActive` *(boolean, opcional, default: true)*.
  - `image` *(binary file, opcional)*: Imagen ilustrativa (PNG o JPEG, máx 5 MiB).
- **Respuesta (`201 Created`)**: Retorna el cofre creado en `data`.

#### `PATCH /api/v1.0/chests/:id`
- **Propósito**: Actualiza campos del cofre.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT**.
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "title": "Nuevo Título",          // opcional
    "description": "Nueva desc",       // opcional
    "periodType": "WEEKLY",           // opcional
    "requiredMissions": 8,            // opcional
    "coinsAmount": 800,               // opcional
    "roomId": 3,                      // opcional, nullable
    "experiencePoints": 150,          // opcional
    "isActive": true                  // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el cofre actualizado en `data`.

#### `POST /api/v1.0/chests/:id/image` y `DELETE /api/v1.0/chests/:id/image`
- **Propósito**: Sube/reemplaza o elimina la imagen del cofre.
- **POST Content-Type**: `multipart/form-data` con campo `file` (binary).
- **Autenticación / Token**: **Admin JWT**.

#### `PATCH /api/v1.0/chests/:id/status`
- **Propósito**: Activa o desactiva la disponibilidad de un cofre.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT**.
- **Parámetros de Ruta**: `id` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "isActive": false
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el cofre actualizado en `data`.

---

### 2.10 Módulo: `PlayerChests` (`/api/v1.0/player-chests`)

Controlador: `PlayerChestsController`

#### `GET /api/v1.0/player-chests/progress`
- **Propósito**: Calcula el progreso en vivo de los cofres activos para el jugador autenticado, optimizado por filtros de periodo o cofre individual.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `periodType` *(enum: `"WEEKLY"` | `"MONTHLY"`, opcional)*: Permite limitar el cálculo al tipo de periodo necesario.
  - `chestId` *(number, opcional)*: Calcula exclusivamente el progreso para un cofre específico.
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
  - `orderBy` *(enum: `"created_at"` | `"periodKey"` | `"id"`, default: `"created_at"`)*.
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*.
  - `take` *(number, default: 50, max: 100)*: Registros por página.
  - `skip` *(number, default: 0)*: Offset.
- **Respuesta (`200 OK`)**: Retorna arreglo paginado de `userMissionChestSchema` con `meta`.

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

##### `GET /api/v1.0/player-chests/admin`
- **Propósito**: Listado general de reclamos y participaciones de cofres para administradores con soporte de filtros. Para ver reclamos inciertos, pasar `?status=TIMEOUT_UNCERTAIN`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `playerId` *(number, opcional)*
  - `chestId` *(number, opcional)*
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`
  - `periodKey` *(string, opcional)*: Ej: `"2026-W39"`
  - `orderBy` *(enum: `"created_at"` | `"periodKey"` | `"id"`, default: `"created_at"`)*
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*
  - `take` *(number, default: 50, max: 100)*
  - `skip` *(number, default: 0)*
- **Respuesta (`200 OK`)**: Retorna arreglo paginado de `userMissionChestSchema` con `meta`.

##### `POST /api/v1.0/player-chests/admin/:claimId/resolve`
- **Propósito**: Resuelve administrativamente un reclamo incierto de cofre.
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (rol `SUPER_ADMIN`).
- **Parámetros de Ruta**: `claimId` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "action": "RESOLVE_CLAIMED", // "RESOLVE_CLAIMED" | "FORCE_RETRY"
    "externalOperationId": "op_9921", // opcional
    "adminNotes": "Acreditado manualmente en panel LuckyBet" // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el reclamo de cofre resuelto en `data`.

---

### 2.11 Módulo: `LevelRewards` (`/api/v1.0/level-rewards`)

Controlador: `LevelRewardsController`

#### `GET /api/v1.0/level-rewards`
- **Propósito**: Historial de recompensas por ascenso de nivel del jugador autenticado. Permite consultar pendientes pasando `?status=PENDING`, filtrar por nivel y ordenar en ambas direcciones.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Player Token** (`Authorization: Bearer <playerToken>` o `x-player-token: <playerToken>`).
- **Query Params**:
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`.
  - `levelId` *(number, opcional)*: Filtrar por nivel.
  - `orderBy` *(enum: `"created_at"` | `"levelId"` | `"id"`, default: `"created_at"`)*.
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*.
  - `take` *(number, default: 50, max: 100)*.
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

##### `GET /api/v1.0/level-rewards/admin`
- **Propósito**: Listado general de recompensas de nivel para administradores con soporte de filtros. Para consultar reclamos en estado incierto, pasar `?status=TIMEOUT_UNCERTAIN`.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `playerId` *(number, opcional)*
  - `levelId` *(number, opcional)*
  - `status` *(enum, opcional)*: `"PENDING"` | `"PROCESSING"` | `"CLAIMED"` | `"TIMEOUT_UNCERTAIN"`
  - `orderBy` *(enum: `"created_at"` | `"levelId"` | `"id"`, default: `"created_at"`)*
  - `orderDirection` *(enum: `"ASC"` | `"DESC"`, default: `"DESC"`)*
  - `take` *(number, default: 50, max: 100)*
  - `skip` *(number, default: 0)*
- **Respuesta (`200 OK`)**: Retorna arreglo paginado de `levelRewardBasicSchema` con `meta`.

##### `POST /api/v1.0/level-rewards/admin/:claimId/resolve`
- **Propósito**: Resuelve un reclamo de nivel incierto (`RESOLVE_CLAIMED` o `FORCE_RETRY`).
- **Tipo de Contenido**: `application/json`
- **Autenticación / Token**: **Admin JWT** (rol `SUPER_ADMIN`).
- **Parámetros de Ruta**: `claimId` (integer).
- **Body de Entrada (JSON)**:
  ```json
  {
    "action": "RESOLVE_CLAIMED", // "RESOLVE_CLAIMED" | "FORCE_RETRY"
    "externalOperationId": "op_lvl_771", // opcional
    "adminNotes": "Fichas acreditadas tras verificación" // opcional
  }
  ```
- **Respuesta (`200 OK`)**: Retorna el reclamo de nivel resuelto en `data`.

---

### 2.12 Módulo: `Statistics` (`/api/v1.0/statistics`)

Controladores: `StatisticsController` (Admin) y `StatisticsPublicController` (Público).

#### Endpoints Administrativos (`SUPER_ADMIN`, `REVIEWER`)

##### `GET /api/v1.0/statistics/summary`
- **Propósito**: Resumen global de emisión de fichas regaladas (reclamadas) y conteos de eventos en un rango temporal.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `startDate` *(string ISO 8601, opcional)*: Fecha inicial (ej: `2026-03-01T00:00:00.000Z`).
  - `endDate` *(string ISO 8601, opcional)*: Fecha final (ej: `2026-03-31T23:59:59.999Z`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Resumen de estadísticas obtenido exitosamente",
    "data": {
      "coinsBreakdown": {
        "missionsCoins": 150000,
        "levelsCoins": 85000,
        "chestsCoins": 220000,
        "totalCoins": 455000
      },
      "eventsCount": {
        "completedMissionsCount": 1250,
        "levelUpsCount": 420,
        "claimedChestsCount": 180
      }
    }
  }
  ```

##### `GET /api/v1.0/statistics/liabilities`
- **Propósito**: Reporte financiero de pasivo flotante (`PENDING`), volumen de fichas reclamadas (`CLAIMED`) y tasa de reclamo (% Claim Rate).
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `startDate` *(string ISO 8601, opcional)*
  - `endDate` *(string ISO 8601, opcional)*
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Reporte de pasivos obtenido exitosamente",
    "data": {
      "pendingCoins": 35000,
      "claimedCoins": 455000,
      "claimRate": 92.86,
      "pendingClaimsCount": 65,
      "breakdown": {
        "missionsPendingCoins": 12000,
        "levelsPendingCoins": 8000,
        "chestsPendingCoins": 15000
      }
    }
  }
  ```

##### `GET /api/v1.0/statistics/operational/risk`
- **Propósito**: Monitoreo de incidencias y transacciones en estado `TIMEOUT_UNCERTAIN` con saldo retenido en riesgo.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `startDate` *(string ISO 8601, opcional)*
  - `endDate` *(string ISO 8601, opcional)*
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Reporte de riesgo operativo obtenido exitosamente",
    "data": {
      "uncertainClaimsCount": 3,
      "uncertainCoinsAmount": 4500,
      "breakdown": {
        "missions": {
          "count": 1,
          "coinsAmount": 1000
        },
        "levels": {
          "count": 1,
          "coinsAmount": 1500
        },
        "chests": {
          "count": 1,
          "coinsAmount": 2000
        }
      }
    }
  }
  ```

##### `GET /api/v1.0/statistics/operational/reviewers-sla`
- **Propósito**: Medición de SLA y rendimiento del equipo de moderadores/reviewers en la evaluación de submissions de misiones.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `startDate` *(string ISO 8601, opcional)*
  - `endDate` *(string ISO 8601, opcional)*
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Reporte de SLA de revisores obtenido exitosamente",
    "data": {
      "globalAverageReviewTimeMinutes": 14.35,
      "totalReviewedStepsCount": 350,
      "reviewers": [
        {
          "adminId": 2,
          "adminUsername": "reviewer_carlos",
          "reviewedStepsCount": 200,
          "approvedStepsCount": 180,
          "rejectedStepsCount": 20,
          "averageReviewTimeMinutes": 11.2
        },
        {
          "adminId": 3,
          "adminUsername": "reviewer_ana",
          "reviewedStepsCount": 150,
          "approvedStepsCount": 140,
          "rejectedStepsCount": 10,
          "averageReviewTimeMinutes": 18.55
        }
      ]
    }
  }
  ```

##### `GET /api/v1.0/statistics/missions/engagement`
- **Propósito**: Métricas de gamificación y engagement sobre misiones: tasa de completitud, abandonadas en progreso y tiempo promedio de completitud.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `startDate` *(string ISO 8601, opcional)*
  - `endDate` *(string ISO 8601, opcional)*
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Métricas de engagement de misiones obtenidas exitosamente",
    "data": {
      "completionRate": 78.45,
      "completedCount": 1250,
      "inProgressCount": 280,
      "cancelledOrExpiredCount": 63,
      "averageCompletionMinutes": 48.2
    }
  }
  ```

##### `GET /api/v1.0/statistics/levels/distribution`
- **Propósito**: Pirámide de niveles: distribución de jugadores activos por cada nivel y porcentaje respecto a la base total de jugadores activos.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Distribución de jugadores por nivel obtenida exitosamente",
    "data": {
      "totalActivePlayers": 1500,
      "distribution": [
        {
          "levelId": 1,
          "levelName": "Bronce",
          "minExperience": 0,
          "playersCount": 900,
          "percentage": 60
        },
        {
          "levelId": 2,
          "levelName": "Plata",
          "minExperience": 1000,
          "playersCount": 450,
          "percentage": 30
        },
        {
          "levelId": 3,
          "levelName": "Oro",
          "minExperience": 5000,
          "playersCount": 150,
          "percentage": 10
        }
      ]
    }
  }
  ```

##### `GET /api/v1.0/statistics/chests/summary`
- **Propósito**: Progreso, adopción y distribución de fichas por cofre para un período determinado.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: **Admin JWT** (Cookie `accessToken`, roles `SUPER_ADMIN` o `REVIEWER`).
- **Query Params**:
  - `periodKey` *(string, opcional)*: Clave del período (ej: `"2026-W10"` o `"2026-03"`). Si se omite, calcula el período semanal actual ISO.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Resumen de progreso de cofres obtenido exitosamente",
    "data": {
      "periodKey": "2026-W10",
      "chests": [
        {
          "chestId": 1,
          "chestTitle": "Cofre Semanal Bronce",
          "requiredMissions": 5,
          "coinsAmount": 500,
          "periodType": "WEEKLY",
          "participantsCount": 120,
          "claimedCount": 95,
          "claimRate": 79.17,
          "totalCoinsDistributed": 47500
        }
      ]
    }
  }
  ```

---

#### Endpoints Públicos / Gamificación

##### `GET /api/v1.0/statistics/leaderboard`
- **Propósito**: Ranking público de jugadores con más fichas acumuladas por recompensas (misiones + niveles + cofres). Ideal para tablas de clasificación en la UI de clientes y jugadores.
- **Tipo de Contenido**: Sin cuerpo.
- **Autenticación / Token**: Pública (Ninguno).
- **Query Params**:
  - `period` *(enum: `"WEEKLY"` | `"MONTHLY"` | `"ALL_TIME"`, default: `"ALL_TIME"`)*: Período a consultar.
  - `limit` *(number, default: 20, max: 100)*: Cantidad máxima de jugadores en el ranking.
- **Respuesta (`200 OK`)**:
  ```json
  {
    "status": true,
    "message": "Ranking de jugadores obtenido exitosamente",
    "data": {
      "period": "WEEKLY",
      "startDate": "2026-03-09T00:00:00.000Z",
      "endDate": "2026-03-15T23:59:59.999Z",
      "leaderboard": [
        {
          "rank": 1,
          "playerId": 10,
          "username": "luckymaster",
          "totalCoins": 25000,
          "missionsCoins": 10000,
          "levelsCoins": 5000,
          "chestsCoins": 10000
        },
        {
          "rank": 2,
          "playerId": 15,
          "username": "gaby_player",
          "totalCoins": 18000,
          "missionsCoins": 8000,
          "levelsCoins": 5000,
          "chestsCoins": 5000
        }
      ]
    }
  }
  ```

---

### 2.13 Módulo: `Health` (`/api/v1.0/health`)

Controlador: `HealthController`

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
