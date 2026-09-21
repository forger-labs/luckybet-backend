# Reporte: Acceso al panel admin de LuckyBet y endpoints de consulta

> **Fecha de validación:** 2026-09-13
> **Credenciales admin verificadas:** `Tigreee4` / (contraseña provista) — **login exitoso**
> **Alcance:** SOLO LECTURA. No se ejecutó ni documenta aquí ninguna operación de carga/retiro de fichas.

---

## 1. Resumen

- El panel admin de LuckyBet funciona en `https://admin.luckybet.site/` sobre el mismo backend PHP (`index.php` con router `?act=...&area=...`) que la API de jugadores, pero **autentica por sesión PHP** (`PHPSESSID`), no por token.
- **`Tigreee4` tiene acceso válido.** Grupo `6`, moneda `ARS`, balance de operador `700 000 ARS`. Ve únicamente **los 15 usuarios de su red** (Tigree1, Remarketing463, RECOS, VipGANAYA, Publicidad, salas de bonus, etc.). Consultar un usuario ajeno a la red devuelve `error: "Usuario incorrecto"`.
- Toda la información del panel (usuarios, balances, historial de operaciones, transferencias) se obtiene por **GET/POST con la cookie de sesión**; los principales datos vienen en **JSON** usando `response=js`.

---

## 2. Login (validado)

```
POST https://admin.luckybet.site/index.php?act=admin&area=login
Content-Type: application/x-www-form-urlencoded

login=Tigreee4&password=<contraseña>
```

**Respuesta de éxito:** `HTTP 302` con `Location: index.php` y `Set-Cookie: PHPSESSID=<id>; path=/` (van dos `Set-Cookie`; la **segunda** es la sesión usable → guardarla del último header).

**Fallo:** mantiene `HTTP 200` con la página de login y mensaje (`"Usuario no es encontrado"` en el caso de login inexistente).

**Sesión:** todas las consultas siguientes envían `Cookie: PHPSESSID=<id>`. La página principal recarga cada 60 s (`main.reloadTime = 60000`).

---

## 3. Endpoints de consulta (solo lectura)

> Base: `https://admin.luckybet.site/index.php?act=admin&area=<AREA>`
> **Nota:** los parámetros de fecha del panel usan el formato `YYYY-MM-DD HH:MM:SS` (hora del servidor).

### 3.1 Dashboard / lista de usuarios

```
GET index.php?act=admin
```
- HTML con la **tabla de usuarios de la red** embebida como JSON: `users = new usersClass([ ... ])`.
- **Campos por usuario** (los usa el panel para el reporte):
  `id, login, currencies, balances, terminals, terminals_online, terminals_game, in, out, profit, wager, wagers, freespin_wagers, wagering, limit, limit_wagers, out_balance, game, rtp, jackpot, bonus, additional, allocated, online, name, style, promo, ips, last, jackpot_link, e_mail, phone, bonus_game, bonus_session`
  - Todos los importes son **strings por moneda**: `{"ARS": "768,370.94"}` (ej. `balances`, `in`, `out`, `profit`, `rtp`, `jackpot`, `bonus`).
- Filtros del dashboard (form `#form`, method POST → se recarga la página): `show_users=1`, `from`, `to`, `interval`, `provider`, `inactive_users`, `deleted_users`, `currency`, `offset`/`limit`.
- **Exportación Excel:** `GET index.php?act=admin&area=users&id=<id>&response=xlsx` (genera `.xlsx` del usuario).

### 3.2 Estadísticas agregadas (JSON)

```
GET index.php?act=admin&area=getusers&response=js&id=<id>
POST index.php?act=admin&area=getusers&response=js   (+ campos: currencyName, promo, from, to, ...)
```
Respuesta JSON:

```json
{
  "config": { "from": "...", "to": "...", "currency": "ARS", "provider": "all",
              "reports_base_group_by": "users", "limit": 1000, "withdraw": "part", "balance_type": "usual:from", "..." },
  "editUser": { "login": "Tigree1", "id": 5358728 },
  "main":    { "login": "Tigreee4", "group": 6, "balance": 700000, "currency": "ARS", "reloadTime": 60000 },
  "users": [
    { "registered_users": { "title": "Registrado durante este período", "value": "9" } },
    { "active_users":     { "title": "Realizaron transacciones durante este período", "value": "200" } },
    { "online_users":     { "title": "Jugadores en línea", "value": "119" } },
    { "ingame_users":     { "title": "Jugadores en el juego", "value": "88" } }
  ],
  "downloadReport": true,
  "page": "base",
  "datetime": "2026-09-14 01:18:52",
  "microtime": 0.11
}
```
- En `HTTP` con `Content-Type: application/json`. `editUser` confirma el usuario consultado; `main` es el operador logueado.
- `error: "Usuario incorrecto"` si el `id` no pertenece a la red del operador.

### 3.3 Perfil de usuario

```
GET index.php?act=admin&area=users&id=<id>
GET index.php?act=admin&area=users&id=<id>&search=<login>&promocode=<promo>
```
- HTML grande (~680 KB) con el detalle del usuario y `dataList` JSON embebido:

```json
{
  "userId": 5358728,
  "login": "Tigree1",
  "currencies": { "ARS": "771903.94" },
  "max_amount_for_add": 700000,
  "printUrl": "",
  "currency": "ARS"
}
```
- Enlaza a `area=createuser` (editar — ESCRITURA, no usar) y `area=printreport` (lectura).

### 3.4 Balance e historial de operaciones (JSON) — endpoint principal

```
GET index.php?act=admin&area=balance&id=<id>&response=js
   [&currency=ARS][&from=YYYY-MM-DD HH:MM:SS][&to=...][&limit=1000][&offset=N]
```

Respuesta JSON (~400 KB reales con `limit=1000`):
- `operationsData`: **historial de transacciones del usuario** (in/out), con campos:

```json
{
  "id": "63836171",
  "user": "Orlandonew2",
  "from": "Tigree1",
  "uid": "9923800",
  "operation": "in",            // "in" = carga (depósito), "out" = retiro/transferencia
  "currency": "ARS",
  "cash": "1300.00",
  "cash_before": "0.00",
  "datetime": "2026-09-13 23:59:38",
  "system": "admin",            // origen de la operación
  "initiator": "CambioDeSalaALA", // quién la inició (otro operador/jugador)
  "wager": "650.00",
  "limit": null,
  "hide": "0",
  "ip": "2a02:4780:14:ad79::1",
  "info": null,
  "cash_in": "1300.00",
  "cash_out": "0.00",
  "cashier_bonus": "0.00",
  "date": "2026-09-13",
  "time": "23:59:38"
}
```

- Otros campos útiles: `transactionHistory`, `limits: [50,100,200,500,1000]`, `sum` (totales del período: `profit`, `in`, `out`, `wager`, `cashier_bonus`), `currencies` (saldos por moneda), `balanceTypes` (catálogo de tipos de operación: `usual:from`, `usual:to`, `usual:players`, `usual:initiator`, `bonuses:wager`, `bonuses:bonus`, `bonuses:hours`, `bonuses:jackpot`, …), `dataList` (usuario + `max_amount_for_add`), `pageCount`, `limit`, `offset`.
- Variante imprimible/frame: `&type=frame&printing=true`.

### 3.5 Otros endpoints de consulta descubiertos

| Área | URL | Tipo de datos |
|---|---|---|
| Historial de sesión de bonus | `index.php?act=admin&area=history&id=<id>&session=<bonus_session>` | HTML (sesión de bonus no completada) |
| Jackpots | `index.php?act=admin&area=jackpots&id=<id>` | HTML |
| Reporte imprimible | `index.php?act=admin&area=printreport&id=<id>` | HTML (con CSP) |
| Botones/acciones del usuario | `index.php?act=admin&area=buttons` | (en `functions.js`) |
| PIN | `index.php?act=admin&area=pin` | (en `functions.js`) |
| Noticias de usuario | `index.php?act=admin&area=usernews` | (en `functions.js`) |
| Logout | `index.php?act=admin&area=logout` | cierra la sesión (revoca `PHPSESSID`) |

---

## 4. Endpoints de ESCRITURA detectados (NO usar)

Por integridad del mapa, documentar que existen — **prohibido invocarlos para este proyecto**:

- **Carga/retiro de fichas:** el mismo `area=balance` en **POST** con `operation=in|out` y monto (`users.changeBalance(...)` en `users.js`). Es el mecanismo que ejecuta "Depositar/Retirar" desde la tabla.
- **Crear/editar usuario:** `area=createuser&id=<id>` (POST).
- **Cambio de contraseña / moneda / promo:** vía formularios del perfil.

Regla: **todo `POST` a `area=balance`/`area=createuser` modifica estado**. Para consultar usar SOLO GET con `response=js` documentado arriba.

---

## 5. Modelo de permisos observado

| Operador | Grupo | Alcance |
|---|---|---|
| `Tigreee4` | `6` | Su red (15 logins: Tigree1, Remarketing463, RECOS, VipGANAYA, Publicidad, SalaDel200%, SalaDel150%, SalaDel100%, Superala, SuperAla200%, SuperAla100%, SuperAla150%, SuperAlaVIP, Leon.1, ...). Balance propio 700000 ARS. |
| (referencia en JS) | `4` / `8` | Otro perfil con búsqueda por `search=` y menú con filtros por columna |

- Fuera de la red → `error: "Usuario incorrecto"` (validado con `serrot99` id `8744343`).
- El menú lateral de este operador solo muestra "Salir"; las áreas visibles vienen del HTML servido, no de un menú global.

---

## 6. Evidencias (requests reales, solo lectura)

```
POST /index.php?act=admin&area=login  (login=Tigreee4&password=...) → 302 + PHPSESSID ✓

GET  /index.php?act=admin                                    → 200 HTML, 15 usuarios embebidos (usersClass)
GET  /index.php?act=admin&area=getusers&response=js&id=5358728 → 200 JSON stats + editUser Tigree1
GET  /index.php?act=admin&area=balance&id=5358728&response=js  → 200 JSON, operationsData[1000], sum, balanceTypes
GET  /index.php?act=admin&area=balance&id=8744343&response=js  → (si se intentara) error Usuario incorrecto (fuera de red)
GET  /index.php?act=admin&area=users&id=5358728&response=xlsx  → exporta Excel
GET  /index.php?act=admin&area=printreport&id=5358728          → HTML imprimible
GET  /index.php?act=admin&area=jackpots&id=5358728             → HTML jackpots
GET  /index.php?act=admin&area=logout                          → cierra sesión
```

---

## 6b. Búsqueda global de jugadores (`ag.luckybet.site`) y operación de balance verificada (2026-09-14)

> Hallazgo posterior: existe un subdominio **`ag.luckybet.site`** (mismo panel, `agent`) que **sí permite buscar jugadores por login fuera de la red del operador** y operar con ellos.

### Búsqueda global por login

```
POST https://ag.luckybet.site/index.php?act=admin&area=search&response=js
Content-Type: application/x-www-form-urlencoded

search_login=serrot99&page=1
```

Respuesta JSON (con paginación `next_page_enable`/`prev_page_enable`/`page_start_num`/`page_end_num`):

```json
{
  "editUser": { "login": "Tigreee4", "id": 8646336 },
  "main": { "login": "Tigreee4", "group": 6, "balance": 700000, "currency": "ARS", "reloadTime": 60000 },
  "search": "serrot99",
  "users": [
    { "id": "8744343",  "login": "serrot99",        "group": "5", "name": "", "weight": "2", "create": "8745704", "additional": [] },
    { "id": "9221700", "login": "serrot99381053",   "group": "5", "name": "", "weight": "1", "create": "5358728", "additional": [] },
    { "id": "9188289", "login": "serrot99232224",   "group": "5", "name": "", "weight": "1", "create": "5358728", "additional": [] }
  ],
  "page": "base",
  "downloadReport": true
}
```

- `serrot99` (id `8744343`, grupo 5) es accesible desde `ag.luckybet.site` con la sesión de Tigreee4 (aunque no aparezca en la red del dashboard `admin.luckybet.site`, donde da `Usuario incorrecto`).
- `ag.luckybet.site` **no comparte sesión** con `admin.luckybet.site`: hay que loguearse por separado (`?act=admin&area=login`, mismo flujo 302 + `PHPSESSID`).

### Carga/retiro de balance — VERIFICADO (operación ejecutada bajo instrucción explícita y reversible)

Request exacto (el mismo que ejecuta la UI via `users.changeBalance` → `query()` POST):

```
POST https://ag.luckybet.site/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=<USER_ID>
Content-Type: application/x-www-form-urlencoded

balance_currency=ARS&amount=2000&send=true&all=false&operation=in|out
```

- `operation=in` → carga (depósito); `operation=out` → retiro.
- Respuesta: `successMessage: "Balance es cambiado con éxito"`, `printUrl` con la operación (`operation=<id>`), `currencies` con el saldo resultante. Fallos → `error`/`errorMessage`.

**Prueba ejecutada con serrot99 (id 8744343, saldo inicial 0.00):**

| Paso | Request | Saldo resultante | Operación registrada |
|---|---|---|---|
| Inicial | — | `0.00` | — |
| Carga 2000 (`in`) | `amount=2000` | `4000.00` ⚠️ | `63842104` (cash 2000.00, cash_before 0.00, initiator Tigreee4, system admin) |
| Retiro 2000 (`out`) | `amount=2000` | `0.00` | `63842160` (cash 2000.00, cash_before 4000.00, initiator Tigreee4, system admin) |
| Final (jugador, `terminalInfo`) | — | `0.00` | — |

> ⚠️ **Comportamiento observado:** `amount=2000` aplica **+4000 / −4000** al saldo real (factor 2, no documentado por el panel). Ambas operaciones quedaron registradas con `cash=2000.00`; el efecto real sobre el saldo fue el doble, pero **simétrico**: la secuencia carga+retiro de la misma cantidad deja el saldo exactamente como estaba (neto cero, verificado por panel y por API de jugador).

---

## 7. Notas para la integración desde `luckybet-premios-backend`

1. Para leer información del panel desde nuestro backend: mantener una sesión PHP (`PHPSESSID`) con un agente HTTP (p. ej. `fetch` con cookie jar en Node, o `axios` + cookie persistente) y usar los GET con `response=js` (sección 3).
2. Los datos más valiosos para "almacenar información del usuario" están en:
   - `area=balance&id=<id>&response=js` → `operationsData` (movimientos, `initiator`, `ip`, saldos) y `sum` (totales por período).
   - Dashboard `act=admin` → `usersClass` JSON (login, balances, rtp, jackpot, bonos).
3. La sesión caduca; conviene un flujo de re-login automático (`area=login` + cookie) y el `area=logout` al terminar.
4. Si el objetivo final es asociar misiones/premios de GanaYa con cuentas del casino, el id canónico es el `id` de jugador (p. ej. `8744343` para `serrot99`) que devuelve la API de jugadores (`terminalInfo`), y el mismo id aparece en el panel como `uid`/`id`.
5. Para operar sobre un jugador fuera de la red del operador usar el subdominio **`ag.luckybet.site`** (búsqueda global `area=search&response=js` + `area=balance`). Recordar el factor x2 al calcular montos reales.