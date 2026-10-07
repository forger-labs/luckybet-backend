# LuckyBet Client Design — Change `luckybet-client`

## Summary

Módulo hexagonal `src/luckybet` con dos adaptadores HTTP independientes (jugadores JSON y panel form-urlencoded con sesión), un core de orquestación sin conocimiento de HTTP, persistencia propia del jugador y de operaciones, y controlador expuesto bajo guards de rol.

## Architecture Decisions

### ADR-1: Dos adaptadores HTTP, no uno

- **Contexto:** las dos interfaces de LuckyBet difieren en formato de body (JSON vs form-urlencoded), autenticación (token en body vs sesión PHP) y método (solo POST vs GET/POST).
- **Decisión:** `ForPlayersApi` (stateless, JSON) y `ForPanelApi` (stateful, sesión + form) como puertos driven separados, cada uno con su adaptador.
- **Consecuencias:** core y negocio no conocen HTTP; cada formato se aísla en su adaptador; tests de core con mocks de puertos (patrón del repositorio).

### ADR-2: Sesión del panel gestionada por el adaptador con re-login automático

- **Contexto:** el panel exige `PHPSESSID`; la sesión caduca en minutos; el panel distingue sesión inválida con `{"noMain":true,"redirect":"login"}` o `302`.
- **Decisión:** el adaptador mantiene la cookie en un store en memoria con TTL configurable (`LUCKYBET_SESSION_TTL_MS`, default 240000) y ante expiración hace login + **un** reintento de la operación original.
- **Consecuencias:** sin redis en fase inicial (se evalúa en Fase 5 para multi-instancia); reintentos limitados para no amplificar errores.

### ADR-3: Factor de balance configurable, no mágico

- **Contexto:** verificado empíricamente que `amount=2000` produce ±4000 de saldo real (factor ×2 no documentado por el proveedor).
- **Decisión:** `LUCKYBET_BALANCE_FACTOR` (default `2`) aplicado en el core (nunca dentro del adaptador), con `amount_real = amount_requested * factor`.
- **Consecuencias:** si el proveedor corrige/documenta la semántica, solo cambia una variable de entorno.

### ADR-4: Idempotencia por `operation_id` del panel

- **Contexto:** el panel devuelve `printUrl` con `operation=<id>`; ante timeout no sabemos si la operación se aplicó.
- **Decisión:** extraer ese id, persistir en `luckybet_operations.operation_id` (constraint único) y **no reintentar** ids ya registrados; si el id es desconocido pero falló el request, reintentar con la misma operación poderosa de consulta previa (`getBalance`).
- **Consecuencias:** escrituras seguras ante reintentos; auditoría completa (incluye `initiator` reportado por el panel).

### ADR-5: Id canónico = `terminalInfo.id` = `uid` del panel

- **Contexto:** el id de jugador de la API (`8744343` para serrot99) coincide con el `id`/`uid` del panel.
- **Decisión:** `luckybet_players.casino_id` guarda ese id como clave única de integración; ningún login ni id interno del casino distinto reemplaza esta clave.
- **Consecuencias:** cruces entre misiones locales y saldos/movimientos del panel sin ambigüedad.

## Sequence Diagrams

### Verificación de token y sync del jugador

```
Frontend GanaYa         Backend (core)           PlayersApiClient         api.luckybet.site
      │  token               │                         │                        │
      │─────────────────────►│  verifyPlayerToken      │                        │
      │                      │────────────────────────►│  POST ?act=command    │
      │                      │                         │  {cmd:terminalInfo,   │
      │                      │                         │   token, version,     │
      │                      │                         │   domain}             │
      │                      │                         │──────────────────────►│
      │                      │                         │◄──────────────────────│ {status:success,
      │                      │◄────────────────────────│   content:{id,login,  │  ...}
      │                      │  upsert luckybet_players│   cash,currency}      │
      │                      │  (casino_id único)      │                        │
      │◄─────────────────────│  usuario autenticado    │                        │
```

### Búsqueda global de jugador (panel)

```
Operador            Backend (core)           PanelApiClient            ag.luckybet.site
      │  findPlayer(login)    │                         │                        │
      │──────────────────────►│────────────────────────►│  POST area=search     │
      │                       │                         │  search_login&page    │
      │                       │                         │  (Cookie PHPSESSID)    │
      │                       │                         │──────────────────────►│
      │                       │                         │◄──────────────────────│ {users:[{id,login,..}]}
      │◄──────────────────────│  [{id,login,group,...}] │                        │
```

### Crédito de fichas con idempotencia (factor ×2)

```
Core                    PanelApiClient             ag.luckybet.site      luckybet_operations
  │ credit(userId, fichas)  │                            │                       │
  │────────────────────────►│ POST area=balance          │                       │
  │  amount=fichas (factor  │  operation=in, send=true   │                       │
  │  aplicado en core →     │  ... (Cookie)              │                       │
  │  amount_requested=fichas│───────────────────────────►│                       │
  │  amount_real=fichas*fact│◄───────────────────────────│ successMessage,       │
  │                         │   printUrl?operation=<id>  │  printUrl             │
  │                         │───────────────────────────►│  INSERT operation_id  │
  │  verificación           │  (si ya existe → no        │  (unique)             │
  │  getBalance →           │   reintentar)              │                       │
  │  reconcilia saldo       │                            │                       │
```

## File Structure

```
src/luckybet/
├── luckybet.module.ts                 # registro de providers y controller
├── constants.ts                       # tokens de inyección + factor default
├── ports/
│   ├── driven/
│   │   ├── ForPlayersApi.ts           # JSON, stateless
│   │   └── ForPanelApi.ts             # form + sesión
│   └── driver/
│       └── ForLuckyBet.ts             # alto nivel (core)
├── adapters/
│   ├── driven/
│   │   ├── players-api.client.ts
│   │   ├── panel-api.client.ts
│   │   └── panel-session.store.ts     # PHPSESSID con TTL
│   └── driver/
│       └── luckybet.controller.ts
├── app/
│   ├── luckybet.core.ts
│   └── dto/
│       └── luckybet.schema.ts         # Zod
└── (specs unitarios junto a cada *.ts)
```

Entidades/migraciones TypeORM (fuera de `src/luckybet`, en `src/shared/entities` como convención): `LuckyBetPlayer`, `LuckyBetOperation`.

## Environment Variables

| Variable | Default | Notas |
|---|---|---|
| `LUCKYBET_API_BASE` | `https://api.luckybet.site` | API jugadores |
| `LUCKYBET_PANEL_HOST` | `https://ag.luckybet.site` | Panel (búsqueda global + operaciones) |
| `LUCKYBET_ADMIN_LOGIN` | — | operador |
| `LUCKYBET_ADMIN_PASSWORD` | — | secreto, nunca en git |
| `LUCKYBET_API_VERSION` | `9` | protocolo |
| `LUCKYBET_DOMAIN` | `luckybet.site` | dominio de config |
| `LUCKYBET_BALANCE_FACTOR` | `2` | factor ×2 (ADR-3) |
| `LUCKYBET_SESSION_TTL_MS` | `240000` | TTL PHPSESSID |
| `LUCKYBET_TIMEOUT_MS` | `5000` | timeout HTTP |
| `LUCKYBET_CREDIT_ENABLED` | `false` | feature flag de escrituras (defensa en profundidad) |

## Security Considerations

1. **Solo lectura por defecto**: `LUCKYBET_CREDIT_ENABLED=false` hasta Fase 3 aprobada.
2. Guards de rol sobre `credit`/`debit` (solo `SUPER_ADMIN`).
3. Zod estricto: `amount` entero positivo, moneda en whitelist (`ARS`), topes configurables.
4. Credenciales y `PHPSESSID` jamás en logs; máscara en cualquier trace.
5. TLS obligatorio; sin headers de cookie compartidos con otros módulos.
6. Auditoría por operación (usuario interno + `initiator` del panel + `operation_id`).

## Test Strategy

- **Unit (Jest + ts-jest):** core con puertos mockeados (patrón `*.spec.ts` junto al archivo), DTO Zod, factor ×2, idempotencia (duplicado → rechazado), mapeo de errores (401/404/502).
- **Integration:** contacto real contra `api.luckybet.site` y `ag.luckybet.site` con cuentas de prueba (login, `terminalInfo`, `area=search`, `area=balance`); **crédito/débito neto cero** con reconciliación (patrón verificado en investigación).
- **E2E/supertest:** controlador con guards (401 sin rol, 400 con monto inválido).
- **Gate:** `pnpm test` + `pnpm build` + cobertura ≥ 80 %.