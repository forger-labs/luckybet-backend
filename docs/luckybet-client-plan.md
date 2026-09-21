# Plan: cliente LuckyBet para `luckybet-premios-backend` (esqueleto)

> **Estado:** PLANIFICACIÓN (sin código implementado). Fecha: 2026-09-14.
> **Objetivo:** definir la arquitectura y los contratos de dos clientes HTTP hacia LuckyBet (API de jugadores y panel admin/agente), para integrarlos al módulo de misiones. Este documento es el contrato de diseño; la implementación queda para una fase posterior (ver §13).

---

## 1. Referencias

| Documento | Contenido |
|---|---|
| `luckybet-login-report.md` | Login y token de la API de jugadores (`api.luckybet.site/?act=command&area=cmd`, JSON) |
| `luckybet-admin-report.md` | Panel admin/agente: sesión PHP, endpoints de consulta y de escritura, factor ×2 |
| `luckybet-api-guide.md` | Métodos HTTP y formatos de request de ambas APIs (JSON vs form-urlencoded) |
| `openspec/config.yaml` | Convenciones del repo: hexagonal, Zod, TDD, Biome |

---

## 2. Contexto (qué estamos integrando)

LuckyBet expone dos interfaces independientes:

1. **API de jugadores** — `api.luckybet.site/?act=command&area=cmd`
   - `POST` + body **JSON** (`version:9`, `domain:"luckybet.site"`, `token` en el body).
   - Comandos: `authorization` (login usuario), `terminalInfo` (verificar token + perfil), `gameList`, `userLogout`.
   - **Sin estado** (el token viaja con cada request).

2. **Panel admin/agente** — `admin.luckybet.site` y `ag.luckybet.site` `/index.php?act=admin&area=<AREA>`
   - `POST`/`GET` + body **form-urlencoded** (PHP `$_POST`).
   - **Con estado**: sesión `PHPSESSID` (cookie) conseguida con `area=login`; caduca en minutos; `admin` y `ag` tienen sesiones separadas.
   - Áreas de lectura: `search` (búsqueda global de jugador, **solo POST**), `getusers`, `balance` (GET consulta), `users` (perfil), `jackpots`, `history`, `printreport`, `response=xlsx`.
   - Área de escritura: `balance` (POST `operation=in|out`) — **factor ×2** observado en el efecto sobre saldo.

---

## 3. Arquitectura propuesta (hexagonal, siguiendo `src/players` y `src/auth`)

```
                    ┌─────────────────────────────────────────────┐
                    │            src/luckybet (módulo)            │
                    │                                             │
  Endpoints HTTP    │  ┌──────────────┐    ┌───────────────────┐  │
  (misiones, auth)  │  │  ForLuckyBet │◄───│  LuckyBetCore     │  │   Núcleo de negocio
  ─────────────────►│  │  (puerto     │    │  (orquestación,   │  │   (factor×2, idempotencia,
                    │  │   driver)    │    │  mapeo, logging)  │  │    reglas de misiones)
                    │  └──────────────┘    └───────┬───────────┘  │
                    │                              │ (Ports driven)│
                    │              ┌───────────────┴─────────────┐ │
                    │              ▼                             ▼ │
                    │  ┌──────────────────┐   ┌──────────────────┐ │
                    │  │ PlayersApiClient │   │  LuckybetPanelClient │
                    │  │  (JSON, sin      │   │  (form + sesión, │ │
                    │  │   estado)        │   │   cookie jar,    │ │
                    │  │   api.luckybet   │   │   re-login,      │ │
                    │  │   .site          │   │   ag.luckybet)   │ │
                    │  └──────┬───────────┘   └───────┬──────────┘ │
                    └─────────┼──────────────────────┼─────────────┘
                              ▼                      ▼
                    https://api.luckybet.site   https://ag.luckybet.site
                    (JSON)                      (form-urlencoded + PHPSESSID)
```

**Principios:**
- El **core** no conoce HTTP: usa puertos (`ForPlayersApi` / `ForPanelApi`), testeable con mocks (convención del repo).
- Los **adaptadores** son los únicos que hablan HTTP y conocen formatos (JSON vs form, cookies).
- DTO con **Zod** en el borde de entrada (`dto/luckybet.schema.ts`).
- Config por **env vars** (sección 10), sin secretos en código.

---

## 4. Estructura de archivos propuesta

```
src/luckybet/
├── luckybet.module.ts                    # módulo NestJS (proveedores + controlador)
├── constants.ts                          # inyección (nombres de providers, factor ×2 default)
├── ports/
│   ├── driven/
│   │   ├── ForPlayersApi.ts              # contrato: API jugadores (JSON)
│   │   └── ForPanelApi.ts                # contrato: panel (sesión + form)
│   └── driver/
│       └── ForLuckyBet.ts                # contrato de alto nivel (core)
├── adapters/
│   ├── driven/
│   │   ├── players-api.client.ts         # adaptador JSON (api.luckybet.site)
│   │   ├── panel-api.client.ts           # adaptador form + sesión (ag.luckybet.site)
│   │   └── panel-session.store.ts        # almacén PHPSESSID (TTL) — memoria/Redis opcional
│   └── driver/
│       └── luckybet.controller.ts        # endpoints expuestos (con guards de rol)
├── app/
│   ├── luckybet.core.ts                  # orquestación + reglas (factor×2, idempotencia)
│   └── dto/
│       └── luckybet.schema.ts            # DTOs Zod (entrada/salida)
└── (*.spec.ts junto a cada unidad)       # TDD: core con puertos mockeados
```

---

## 5. Contratos (puertos — diseño)

> Firmas de **diseño** (concepto), no implementación.

### 5.1 `ForPlayersApi` (adaptador: JSON, sin estado)

| Método (concepto) | Entrada | Salida | Uso |
|---|---|---|---|
| `login(login, password)` | credenciales | `{ token }` | obtener token de jugador (solo si el backend autentica usuarios) |
| `getProfile(token)` | token | perfil `{id, login, name, cash, currency}` o `null` | **verificar validez del token** (→ `authorize_error` = token inválido) |
| `setCurrency(token, currency)` | token, moneda | estado | mantener sesión de jugador |

Errores mapeados: `authorize_error` → token inválido (401); `password_not_correct` → credenciales (401); red/5xx → 502/504.

### 5.2 `ForPanelApi` (adaptador: form + sesión)

| Método (concepto) | Entrada | Salida | HTTP real |
|---|---|---|---|
| `searchPlayer(login)` | login | `[{id, login, group, create}]` | `POST area=search&response=js`, form `search_login&page=1` (**solo POST**) |
| `getBalance(userId, {from, to})` | id jugador, rango | saldo + `operationsData[]` + totales | `GET area=balance&response=js` |
| `getUserProfile(userId)` | id jugador | perfil (HTML→datos extraídos) | `GET area=users&id=` |
| `credit(userId, amount)` | id, monto (fichas) | `{operationId}` | `POST area=balance` `operation=in` |
| `debit(userId, amount)` | id, monto (fichas) | `{operationId}` | `POST area=balance` `operation=out` |
| `logout()` | — | — | `GET area=logout` |

El adaptador implementa **sesión**: login automático con credenciales de env, guardar `PHPSESSID` (2ª cookie), detectar expiración (`redirect:"login"` / 302), re-login + reintento una vez, y `logout` al cerrar.

### 5.3 `ForLuckyBet` (core, orquestación)

| Método (concepto) | Comportamiento |
|---|---|
| `verifyPlayerToken(token)` | delega a `ForPlayersApi.getProfile`; devuelve usuario canónico o `null` |
| `findPlayer(login)` | delega a `ForPanelApi.searchPlayer`; normaliza resultado |
| `getPlayerBalance(userId, rango)` | delega a `ForPanelApi.getBalance`; mapea `currencies`/`operationsData` |
| `creditPlayer(userId, fichas)` | aplica **factor ×2** (§8), idempotencia, registra movimiento local, delega a `credit` |
| `debitPlayer(userId, fichas)` | idem con `debit` |
| `syncPlayerFromToken(token)` | verifica token (A) y guarda/actualiza jugador local (id canónico = `terminalInfo.id` = `uid` del panel) |

---

## 6. Comportamiento del adaptador JSON (`PlayersApiClient`)

1. `POST https://api.luckybet.site/?act=command&area=cmd`.
2. Headers: `Content-Type: application/json`; body con `version: 9`, `domain: "luckybet.site"` siempre; `token` solo si el comando lo requiere.
3. Respuesta siempre parseable como JSON (envelope `{status, content, errorCode, error, datetime, microtime}`).
4. Sin reintentos a ciegas; timeout corto (3–5 s); distingue `authorize_error` (401) de fallos transitorios (502).
5. **Sin estado**: ningún cookie; el token se guarda por request/negocio.

---

## 7. Comportamiento del adaptador del panel (`LuckybetPanelClient`)

1. **Sesión**: al arrancar (lazy) `POST area=login` form `login/password` → capturar **la segunda** `Set-Cookie: PHPSESSID`.
2. **Almacén**: `PanelSessionStore` en memoria con TTL (p. ej. 4 min, por debajo del idle real del panel) — a futuro Redis si hay múltiples instancias.
3. **Cada request**: envía `Cookie: PHPSESSID=<id>`; body form-urlencoded construido con `URLSearchParams`.
4. **Detección de sesión caída**: si la respuesta es `{"noMain":true,...,"redirect":"login"}` o un `302` a login ⇒ **re-login + reintento (1 vez)**. Si reintenta y vuelve a fallar ⇒ error 502/504.
5. **Orden y normalización**: `search` y las operaciones de balance son **POST**; las consultas (`getusers`, `balance` consulta) son **GET** con query params (fechas URL-encoded).
6. **Escritura**: `credit/debit` con `send=true`, `all=false`, monto y `operation`; capturar `printUrl` → extraer `operation=<id>` para idempotencia (§8).
7. **Logout** en cierre ordenado (y nunca guardar `PHPSESSID` en logs).

---

## 8. Reglas de negocio del core

1. **Factor ×2 (créditos/débitos):** el `amount` del panel no es el efecto real (verificado: `amount=2000` ⇒ ±4000 de saldo). Configurable: `LUCKYBET_BALANCE_FACTOR` (default `2`).
   - **Decisión abierta:** confirmar la semántica oficial (¿"fichas" del panel = 2×ARS?) antes de automatizar cargas por misiones (ver §14).
2. **Idempotencia:** antes de una escritura, generar/recibir `operationId` (id de la operación del panel: `printUrl?operation=<id>`); registrar en tabla local única (`luckybet_operations.operation_id`) y **no reintentar** una operación ya registrada (evita doble carga en timeouts).
3. **Nunca loguear** passwords ni `PHPSESSID`.
4. **Siempre neto verificable:** tras `credit/debit`, reconciliar con `getBalance` (saldo esperado = inicial ± monto×factor).

---

## 9. Datos locales a persistir (TypeORM)

| Tabla (propuesta) | Campos clave | Propósito |
|---|---|---|
| `luckybet_players` | `casino_id` (único), `login`, `name`, `currency`, `last_sync_at` | **id canónico del jugador** = `terminalInfo.id` = `uid` del panel (serrot99 = `8744343`) |
| `luckybet_operations` | `operation_id` (único), `player_id`, `type` (in/out), `amount_requested`, `amount_real`, `initiator`, `status`, `created_at` | idempotencia + auditoría (incluye el `initiator` que el panel reporta) |
| (relación con `players`/`misiones` existentes) | — | vincular recompensas/misiones al jugador |

---

## 10. Configuración (env vars nuevas)

| Variable | Ejemplo | Nota |
|---|---|---|
| `LUCKYBET_API_BASE` | `https://api.luckybet.site` | API jugadores |
| `LUCKYBET_PANEL_HOST` | `https://ag.luckybet.site` | Panel agente (búsqueda global + operaciones) |
| `LUCKYBET_ADMIN_LOGIN` | `Tigreee4` | operador (usar el de mayor alcance según caso) |
| `LUCKYBET_ADMIN_PASSWORD` | (secreto) | **nunca** en git |
| `LUCKYBET_API_VERSION` | `9` | versión de protocolo |
| `LUCKYBET_DOMAIN` | `luckybet.site` | dominio de config |
| `LUCKYBET_BALANCE_FACTOR` | `2` | factor ×2 (§8.1) |
| `LUCKYBET_SESSION_TTL_MS` | `240000` | TTL de `PHPSESSID` en memoria |
| `LUCKYBET_TIMEOUT_MS` | `5000` | timeout HTTP |

---

## 11. Seguridad y permisos

1. **Solo lectura por defecto.** Los endpoints expuestos que mutan (`credit`/`debit`) se protegen con guard de rol (p. ej. `SUPER_ADMIN` del sistema propio) + validación Zod estricta de montos (rango, moneda).
2. **Cantidades acotadas** (`amount > 0`, tope configurable) y rate limiting.
3. **Auditoría:** cada escritura registra `initiator` (usuario del panel que la ejecuta) y el usuario autenticado de nuestro backend que la solicitó.
4. **TLS obligatorio** (las llamadas son HTTPS) y sin credenciales en logs.
5. **Nunca exponer** `PHPSESSID` ni tokens: el backend es el único cliente.

---

## 12. Endpoints expuestos (alto nivel, propuesto)

| Ruta (bajo `/api/v1.0/luckybet` o similar) | Uso en el negocio |
|---|---|
| `POST /verify-token` (body: `token`) | auth de jugador: valida token del casino y devuelve/normaliza usuario |
| `GET /players/search?login=` | buscar jugador (panel) para admin local |
| `GET /players/:casinoId/balance?from=&to=` | consultar saldo/movimientos |
| `POST /players/:casinoId/credit` (body: `amount`) | abono por misión/recompensa (ESCRITURA, con factor ×2 + idempotencia) |
| `POST /players/:casinoId/debit` (body: `amount`) | descuento (ESCRITURA, idem) |

---

## 13. Fases de implementación (cuando se apruebe)

1. **Fase 0 — Preparación:** mover este plan a un *change* de OpenSpec (o mantener como `PLAN` en repo) y definir los DTOs Zod finales.
2. **Fase 1 — `PlayersApiClient`:** adaptador JSON + `forPlayersApi.spec.ts` (mocks HTTP) + core de `verifyPlayerToken`. **Verificar:** test real contra `api.luckybet.site` en integración.
3. **Fase 2 — `PanelApiClient` lectura:** sesión (login/logout/re-login), `searchPlayer`, `getBalance`. **Verificar:** integración real (búsqueda global serrot99; saldo legible).
4. **Fase 3 — escrituras con idempotencia:** `credit`/`debit` + factor ×2 + tabla `luckybet_operations`. **Verificar:** secuencia carga+retiro neta cero en cuenta de prueba, con reconciliación.
5. **Fase 4 — persistencia y endpoints:** `luckybet_players`, controlador con guards, rate limits, docs Swagger.
6. **Fase 5 — endurecimiento:** Redis para sesión (si multi-instancia), métricas, timeouts finos.

**Criterios de aceptación (por fase):** TDD verde (`pnpm test`), cobertura ≥ 80%, `pnpm build` sin errores, pruebas de integración contra los hosts reales con cuentas de prueba.

---

## 14. Riesgos y decisiones abiertas

| # | Riesgo / duda | Estado |
|---|---|---|
| 1 | **Semántica del monto del panel (factor ×2)** | Verificado empíricamente (0→4000 con amount 2000); falta confirmación oficial. **Bloqueante para Fase 3** |
| 2 | TTL real de la sesión PHP del panel | Medido "minutos"; definir TTL de re-login propio (env) |
| 3 | `admin.luckybet.site` vs `ag.luckybet.site` (alcance) | `ag` permite búsqueda global y operaciones; `admin` restringe por red. Decidir host según caso de uso |
| 4 | Rate limits / bloqueo por IP del panel | Sin evidencia de límite; monitorear (evitar hammering) |
| 5 | ¿El backend debe emitir token de jugador (login con password) o solo validar tokens provistos por el frontend? | Decisión de negocio: GanaYa recibirá el token del casino del navegador (recomendado) en vez de manejar passwords |
| 6 | Multi-instancia del backend (cookie en memoria por pod) | Fase 5: Redis/almacén compartido si aplica |

---

## 15. Próximo paso sugerido

1. Revisar y validar este plan (ajustar nombres, host, factor).
2. **Confirmar la semántica del monto** con el proveedor del panel (riesgo 1) — es lo único que bloquea automatizar cargas.
3. Opcional: convertir a *change* formal de OpenSpec (`openspec/changes/luckybet-client/`) con proposal+spec+design+tasks, y luego implementar por fases con TDD.