# Guía de llamadas API LuckyBet — métodos, formato y funcionamiento

> Consolidado de la investigación (2026-09-13/14). Complementa a `luckybet-login-report.md` (API de jugadores) y `luckybet-admin-report.md` (panel admin).
> **Pregunta clave que responde esta guía: ¿con qué método se llama cada endpoint y qué formato de body se usa?**

---

## 1. Resumen: hay DOS APIs distintas

LuckyBet expone **dos interfaces** con **formatos de request completamente distintos**:

| # | API | Host | Formato del request | Formato de la respuesta |
|---|---|---|---|---|
| **A** | Jugadores (login, perfil, juegos) | `api.luckybet.site` (`?act=command&area=cmd`) | **JSON** (`Content-Type: application/json`) | **JSON** (envelope propio) |
| **B** | Panel admin / agente (usuarios, balance, operaciones) | `admin.luckybet.site` y `ag.luckybet.site` (`index.php?act=admin&area=<AREA>`) | **Form-urlencoded** (`application/x-www-form-urlencoded`) | **JSON** (con `response=js`) o **HTML** |

> **Tu suposición es correcta para el panel admin:** las llamadas del panel **NO usan JSON**. El body viaja como *form data* (`clave=valor&clave2=valor2`). Solo la API de jugadores (`?act=command&area=cmd`) usa body JSON.

---

## 2. Autenticación (importante para ambas)

| API | Mecanismo |
|---|---|
| **A. Jugadores** | Token opaco de 32 hex en el **body JSON** (`"token": "..."`). Se obtiene con login (`cmd: authorization`). No funciona por query ni header. |
| **B. Panel admin** | **Sesión PHP** (`Cookie: PHPSESSID=<id>`). Se obtiene con `POST ?act=admin&area=login`. `admin.luckybet.site` y `ag.luckybet.site` **no comparten sesión** (login por separado). La sesión caduca tras ~minutos de inactividad (el panel redirige a login; el front la mantiene viva recargando cada 60 s). |

---

## 3. API A — Jugadores (`api.luckybet.site`) — body **JSON**

Endpoint único: **`POST`** `https://api.luckybet.site/?act=command&area=cmd`

| Content-Type request | `application/json` |
|---|---|
| Content-Type response | `application/json` |
| Parámetros requeridos | `version: 9`, `domain: "luckybet.site"` (sin ellos no responde) |

Todas las llamadas son **POST** con un `cmd`; los comandos autenticados llevan el `token` en el body:

```sh
# Login (jugador)
POST https://api.luckybet.site/?act=command&area=cmd
Content-Type: application/json
{"cmd":"authorization","type":"login","data":{"login":"serrot99","password":"991702"},"version":9,"domain":"luckybet.site"}
# → {"token":"<32hex>","status":"success","content":{"language":"es"}}

# Verificar token / perfil
POST <mismo endpoint>
{"cmd":"terminalInfo","first":true,"token":"<token>","version":9,"domain":"luckybet.site"}
# → valid: {"status":"success","content":{"id":..., "login":"...", "cash":"...", "currency":"ARS", ...}}
# → inválido: {"errorCode":"authorize_error","error":"Autorización fallida","status":"fail"}
```

Comandos: `authorization`, `terminalInfo`, `gameList`, `userLogout`, `casinoNRegister`, `currencySet`, `casinoPasswordChange`, `passwordRecovery`, `config/getConfig`, `langs/getLanguages`.

---

## 4. API B — Panel admin (`admin.luckybet.site` / `ag.luckybet.site`) — body **form-urlencoded**

### 4.1 Login y logout

```sh
# Login — SOLO POST, form-urlencoded, NO devuelve JSON (302 + Set-Cookie PHPSESSID)
POST https://ag.luckybet.site/index.php?act=admin&area=login
Content-Type: application/x-www-form-urlencoded
login=Tigreee4&password=<pass>
# → 302 Location: index.php + Set-Cookie: PHPSESSID=<id>  (guardar la SEGUNDA cookie)

# Logout — GET simple
GET  https://ag.luckybet.site/index.php?act=admin&area=logout
```

> Todas las llamadas siguientes envían `Cookie: PHPSESSID=<id>`.

### 4.2 Tabla resumen de llamadas del panel

| Llamada | Método | Content-Type request | Body / Query | Respuesta |
|---|---|---|---|---|
| Dashboard (lista red) | **GET** | — | — | HTML (datos embebidos `usersClass`) |
| **Búsqueda global de jugador** | **POST** (obligatorio) | `application/x-www-form-urlencoded` | `search_login=<login>&page=1` | **JSON** `application/json` |
| Estadísticas/getusers | **GET o POST** | form (si POST) | `id`, `from`, `to`, `currency`, `currencyName`, `promo`... | **JSON** |
| Balance: consulta | **GET** | — | `id`, `response=js`, `from`, `to`, `limit`, `offset`... | **JSON** (saldo + `operationsData`) |
| Balance: **carga/retiro** | **POST** | `application/x-www-form-urlencoded` | `balance_currency`, `amount`, `send=true`, `all=false`, `operation=in\|out` | **JSON** (`successMessage`/`error`) |
| Perfil usuario | **GET** | — | `id`, `search`, `promocode` | HTML (con `dataList` JSON embebido) |
| Excel | **GET** | — | `id`, `response=xlsx` | `.xlsx` |
| Historial bonus session | **GET** | — | `id`, `session` | HTML |
| Jackpots | **GET** | — | `id` | HTML |
| Print report | **GET** | — | `id` | HTML |

### 4.3 Detalle: búsqueda global (la que permitió hallar a serrot99)

```sh
# POST — solo funciona con POST (con GET responde 200 pero users=[])
POST https://ag.luckybet.site/index.php?act=admin&area=search&response=js
Content-Type: application/x-www-form-urlencoded
search_login=serrot99&page=1
```

Respuesta JSON:
```json
{
  "editUser": {"login":"Tigreee4","id":8646336},
  "main": {"login":"Tigreee4","group":6,"balance":700000,"currency":"ARS","reloadTime":60000},
  "search": "serrot99",
  "users": [
    {"id":"8744343","login":"serrot99","group":"5","name":"","weight":"2","create":"8745704","additional":[]},
    {"id":"9221700","login":"serrot99381053","group":"5","name":"","weight":"1","create":"5358728","additional":[]},
    {"id":"9188289","login":"serrot99232224","group":"5","name":"","weight":"1","create":"5358728","additional":[]}
  ],
  "next_page_enable": false, "prev_page_enable": false,
  "page_start_num": 1, "page_end_num": 3,
  "page": "base", "downloadReport": true
}
```
- Paginación: `page=N`; respuesta trae `next_page_enable`/`prev_page_enable` y `page_start_num`/`page_end_num`.
- Es la vía para operar jugadores **fuera** de la red del operador (en `admin.luckybet.site` un id ajeno da `error: "Usuario incorrecto"`).

### 4.4 Detalle: consulta de balance (lectura)

```sh
GET https://ag.luckybet.site/index.php?act=admin&area=balance&id=8744343&response=js&limit=5
     &from=2026-09-14%2000:00:00&to=2026-09-14%2023:59:59
# (from/to con espacio → URL-encode: %20)
```
Respuesta JSON: `currencies` (saldo actual por moneda), `operationsData[]` (movimientos: `id, user, from, uid, operation, currency, cash, cash_before, datetime, system, initiator, wager, ip, cash_in, cash_out, cashier_bonus, date, time`), `sum` (totales del período), `limits`, `balanceTypes`, `dataList`, `pageCount`, `limit`, `offset`.

### 4.5 Detalle: operación de balance (carga/retiro) — ESCRITURA

```sh
POST https://ag.luckybet.site/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=8744343
Content-Type: application/x-www-form-urlencoded

balance_currency=ARS&amount=2000&send=true&all=false&operation=in
#   operation=in  → carga (depósito)
#   operation=out → retiro
#   all=false     → retiro parcial por monto; all=true → retiro total
```
Respuesta JSON: `successMessage: "Balance es cambiado con éxito"`, `printUrl` (contiene `operation=<id>` de la operación hecha), `currencies` (saldo resultante). Errores → `error`/`errorMessage`.

> ⚠️ **Factor ×2 observado (2026-09-14):** `amount=2000` con `operation=in` subió el saldo real de 0 a **4000**; `operation=out` con `amount=2000` lo bajó de 4000 a **0**. Efecto real = 2× el `amount`, pero **simétrico** (carga+retiro del mismo monto ⇒ saldo neto inicial). Calcular montos reales con este factor al automatizar cargas de misiones.

---

## 5. Envelope de respuesta (formato común JSON)

Tanto la API de jugadores como el panel usan campos propios (no REST estándar):

```
{ "status": "success"|"fail", "content": {...}, "errorCode": "...", "error": "...",
  "datetime": "YYYY-MM-DD HH:MM:SS", "microtime": 0.0, "main": {...}, "editUser": {...}, ... }
```
- Códigos de error observados: `authorize_error` (token/sesión inválida), `cmd_not_found` (comando inexistente), `password_not_correct`, `currency_not_set`, `Usuario incorrecto` (id fuera de la red del operador).
- El panel distingue consulta vs error con `response=js` → JSON, y cualquier otra cosa → HTML.

---

## 6. Notas de implementación (para `luckybet-premios-backend`)

1. **Dos clientes HTTP distintos:**
   - Jugadores: `POST` + body **JSON** a `api.luckybet.site/?act=command&area=cmd`.
   - Panel: `POST/GET` + body **form-urlencoded** (o query params) a `admin|ag.luckybet.site/index.php?act=admin&area=...`, con **cookie jar** (`PHPSESSID`) y re-login automático al detectar redirección a login o `noMain/redirect: login`.
2. **Nunca mezclar formatos:** body JSON contra el panel devuelve error; form-urlencoded contra la API de jugadores tampoco funciona (requiere JSON).
3. **Sesión del panel:** corta (minutos de inactividad) → guardar cookie, re-login bajo demanda (patrón: si la respuesta es `{"noMain":true,"login":"","redirect":"login"}` o un 302, re-loguear y reintentar).
4. **Factor ×2** en operaciones de balance (sección 4.5) hasta validar la semántica oficial del monto.
5. **Id canónico del jugador:** el `id` de la API de jugadores (`terminalInfo`) = el `id`/`uid` del panel (serrot99 = `8744343`).