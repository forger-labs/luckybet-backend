# Guía de llamadas API LuckyBet — Métodos, Formato y Funcionamiento

> Consolidado y actualizado (2026-09-21) con las especificaciones de arquitectura hexagonal, integración con Redis, seguridad criptográfica (SHA-256) y soporte nativo de historial (`area=history`) e imágenes CDN (`cdn.cdnpin.com`).
> Complementa a `luckybet-login-report.md` (API de jugadores) y `luckybet-admin-report.md` (panel admin/agente).

---

## 1. Resumen de Arquitectura: Dos APIs Distintas

LuckyBet opera con **dos interfaces completamente independientes** con modelos de datos, protocolos y métodos de autenticación diferenciados:

| Característica | API A: Jugadores | API B: Panel Admin / Agente |
| :--- | :--- | :--- |
| **Host Principal** | `https://api.luckybet.site` | `https://ag.luckybet.site` (agente global) / `https://admin.luckybet.site` |
| **Endpoint Base** | `/?act=command&area=cmd` | `/index.php?act=admin&area=<AREA>` |
| **Protocolo / Body** | **JSON** (`Content-Type: application/json`) | **Form-urlencoded** (`application/x-www-form-urlencoded`) |
| **Formato Respuesta** | **JSON** (envelope `{ status: "success" \| "fail", ... }`) | **JSON** (con `response=js`) o **HTML** |
| **Mecanismo Auth** | Token opaco de 32 hex en el **body JSON** | **Sesión PHP (`PHPSESSID`)** vía Header `Cookie: PHPSESSID=<id>` |
| **Propósito Principal** | Autenticación de jugadores, terminal info, catálogo de juegos (`gameList`). | Búsqueda global, consulta y mutación de balance (depósitos/retiros), auditoría de sesiones (`area=history`). |

---

## 2. Seguridad y Gestión de Sesiones en el Backend

### 2.1 Autenticación de Jugadores (`PlayerTokenGuard` y `PanelApiCore`)
- **Validación del Token**: El frontend envía el token en `Authorization: Bearer <token>` o header `x-player-token`.
- **Caché Criptográfico en Redis (SHA-256)**:
  - **Seguridad**: El token en texto plano **nunca se almacena en Redis**.
  - **Clave**: `luckybet:session:token:<sha256_hash>` con un TTL corto de **120 segundos (2 min)**.
  - **Valor**: Contexto del jugador (`PlayerAuthContext`: `id`, `username`, `phone`, `levelId`, `cash`, `currency`).
- **Auto-Registro**: Si `terminalInfo` valida el token pero el jugador no existe en la base de datos local `players`, se crea automáticamente con nivel base y estado activo.
- **Auto-Reactivación (Self-Healing)**: Si un usuario previamente desactivado o eliminado fue restaurado en el panel de LuckyBet y genera un nuevo token válido, el backend lo reactiva automáticamente (`isActive = true`) de forma transparente.

### 2.2 Sesión Admin PHP (`AdminPanelService`)
- **Persistencia en Redis**: Cookie `PHPSESSID` almacenada bajo `luckybet:admin:phpsessid` con TTL de **240 segundos (4 min)**.
- **Auto-Login & Reintento**: Detección automática de sesión expirada (respuestas con `noMain: true`, `redirect: "login"` o código HTTP `302`). Invalida la clave en Redis, re-autentica mediante `POST area=login` (extrayendo la segunda cookie de sesión) y reintenta la petición original en vuelo.

---

## 3. API A — Jugadores (`api.luckybet.site`) — Body JSON

**Endpoint único:** `POST https://api.luckybet.site/?act=command&area=cmd`

Todos los requests requieren en el body JSON:
```json
{
  "version": 9,
  "domain": "luckybet.site"
}
```

### 3.1 Login de Jugador
```http
POST /?act=command&area=cmd HTTP/1.1
Host: api.luckybet.site
Content-Type: application/json

{
  "cmd": "authorization",
  "type": "login",
  "data": {
    "login": "serrot99",
    "password": "password123"
  },
  "version": 9,
  "domain": "luckybet.site"
}
```
**Respuesta:**
```json
{
  "token": "a1b2c3d4e5f6789012345678abcdef01",
  "status": "success",
  "content": {
    "language": "es"
  }
}
```

### 3.2 Terminal Info / Verificación de Token
```http
POST /?act=command&area=cmd HTTP/1.1
Host: api.luckybet.site
Content-Type: application/json

{
  "cmd": "terminalInfo",
  "token": "a1b2c3d4e5f6789012345678abcdef01",
  "first": true,
  "version": 9,
  "domain": "luckybet.site"
}
```
**Respuesta Válida:**
```json
{
  "status": "success",
  "content": {
    "id": 8744343,
    "login": "serrot99",
    "cash": "5000.00",
    "currency": "ARS",
    "game": null,
    "bonus_game": null,
    "last": "2026-09-21 14:00:00"
  }
}
```
**Respuesta Inválida (Expirado o Eliminado):**
```json
{
  "status": "fail",
  "errorCode": "authorize_error",
  "error": "Autorización fallida"
}
```

### 3.3 Catálogo de Juegos e Imágenes CDN (`gameList`)
Obtiene la lista completa de slots y juegos disponibles. Se cachea en Redis bajo `luckybet:catalog:game_list` con TTL de **1 hora (3600 s)**.

```http
POST /?act=command&area=cmd HTTP/1.1
Host: api.luckybet.site
Content-Type: application/json

{
  "cmd": "gameList",
  "token": "a1b2c3d4e5f6789012345678abcdef01",
  "version": 9,
  "domain": "luckybet.site"
}
```
**Estructura de Items del Catálogo:**
```json
{
  "status": "success",
  "content": [
    {
      "id": "sweet_bonanza",
      "name": "sweet_bonanza",
      "title": "Sweet Bonanza 1000",
      "provider": "Pragmatic Play",
      "img": "https://cdn.cdnpin.com/resources/games/sweet_bonanza/icon.png",
      "type": "slots"
    }
  ]
}
```
> **CDN de Imágenes:** Las imágenes públicas residen en `https://cdn.cdnpin.com/resources/...`.

---

## 4. API B — Panel Admin / Agente (`ag.luckybet.site`) — Form-Urlencoded

> **Importante:** Todas las consultas al panel deben enviar `Cookie: PHPSESSID=<id>`.

### 4.1 Login de Operador / Agente
```http
POST /index.php?act=admin&area=login HTTP/1.1
Host: ag.luckybet.site
Content-Type: application/x-www-form-urlencoded

login=Tigreee4&password=secretPassword
```
- **Respuesta:** `302 Found` con `Set-Cookie: PHPSESSID=<id>; path=/`. (Debe capturarse la segunda cookie emitida).

### 4.2 Búsqueda Global de Jugadores (`area=search`)
Permite localizar jugadores en toda la red (incluso fuera del grupo directo del operador). **Requiere método POST.**

```http
POST /index.php?act=admin&area=search&response=js HTTP/1.1
Host: ag.luckybet.site
Content-Type: application/x-www-form-urlencoded
Cookie: PHPSESSID=session_xyz

search_login=serrot99&page=1
```
**Respuesta:**
```json
{
  "users": [
    {
      "id": "8744343",
      "login": "serrot99",
      "group": "5",
      "name": "",
      "weight": "2"
    }
  ],
  "next_page_enable": false,
  "page_start_num": 1,
  "page_end_num": 1
}
```

### 4.3 Historial de Sesiones y Rondas de Juego (`area=history`)
**Endpoint nativo para auditar partidas reales de slots.** Límite máximo de **1.000 registros** por consulta.

```http
GET /index.php?act=admin&area=history&id=8744343&response=js&limit=1000&from=2026-09-14%2000:00:00&to=2026-09-21%2023:59:59 HTTP/1.1
Host: ag.luckybet.site
Cookie: PHPSESSID=session_xyz
```
**Respuesta JSON:**
```json
{
  "sessions": [
    {
      "id": "1849204",
      "game": "sweet_bonanza",
      "game_name": "Sweet Bonanza",
      "datetime": "2026-09-21 12:30:15",
      "wager": "250.00",
      "win": "500.00",
      "session": "sess_89431"
    }
  ]
}
```

### 4.4 Libro Contable de Balances y Movimientos (`area=balance`)
Consulta el libro contable de transacciones y balance histórico de la cuenta.

```http
GET /index.php?act=admin&area=balance&id=8744343&response=js&limit=1000&from=2026-09-14%2000:00:00&to=2026-09-21%2023:59:59 HTTP/1.1
Host: ag.luckybet.site
Cookie: PHPSESSID=session_xyz
```
**Respuesta JSON:**
```json
{
  "currencies": {
    "ARS": "5000.00"
  },
  "operationsData": [
    {
      "id": "63842104",
      "user": "serrot99",
      "from": "Tigreee4",
      "operation": "in",
      "currency": "ARS",
      "cash": "2000.00",
      "cash_before": "0.00",
      "datetime": "2026-09-21 10:15:00",
      "system": "admin"
    }
  ]
}
```

### 4.5 Operaciones de Saldo (Depósitos y Retiros) — Escritura

```http
POST /index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=8744343 HTTP/1.1
Host: ag.luckybet.site
Content-Type: application/x-www-form-urlencoded
Cookie: PHPSESSID=session_xyz

balance_currency=ARS&amount=2000&send=true&all=false&operation=in&bonus=100&promocode=PROMO100
```

#### Parámetros de Operación:
| Parámetro | Tipo | Descripción |
| :--- | :--- | :--- |
| `operation` | `string` | `in` = Carga (depósito) \| `out` = Retiro. |
| `amount` | `number` | Monto nominal de la operación (**Paridad 1:1**). |
| `all` | `string` | `false` = Operación parcial por el monto indicado \| `true` = Retiro total (vaciar saldo de la cuenta). |
| `send` | `string` | `true` para confirmar la ejecución. |
| `bonus` | `number \| string` | *(Opcional)* Código de bono (ej. `100` para 100% de bono de bienvenida). |
| `promocode` | `string` | *(Opcional)* Código promocional asociado a la carga. |
| `cashier_bonus` | `number \| string` | *(Opcional)* Bono asignado por caja/agente. |
| `balance_type` | `string` | *(Opcional)* Tipo de balance contable de destino. |

#### Aclaración sobre Paridad Nominal 1:1 y Bonos de Bienvenida:
> **Nota de Negocio:** Las operaciones se acreditan en **paridad 1:1 nominal**.
> En pruebas iniciales donde recargar `2.000` mostraba un saldo visible de `4.000`, esto no correspondía a un factor multiplicador del panel, sino a la suma del **saldo real acreditable ($2.000 cash)** más el **saldo de bonificación/wager ($2.000 bono 100%)** activo en el jugador de prueba. No se debe aplicar ninguna división o multiplicación artificial en el backend.

---

## 5. Resumen de Claves y TTLs en Redis

| Clave | TTL | Propósito |
| :--- | :--- | :--- |
| `luckybet:session:token:<sha256_hash>` | **120 s (2 min)** | Caché de sesión de jugador autenticado (`PlayerAuthContext`). |
| `luckybet:admin:phpsessid` | **240 s (4 min)** | Cookie de sesión PHP activa del panel de administración/agente. |
| `luckybet:catalog:game_list` | **3600 s (1 h)** | Catálogo completo de juegos e imágenes del CDN. |
| `luckybet:player:recent_games:<userId>:<days>:<limit>` | **300 s (5 min)** | Historial de juegos deduplicados y enriquecidos de la última semana. |
| `luckybet:player:last_game:<playerId>` | **300 s (5 min)** | Último juego jugado o activo por token de jugador. |
