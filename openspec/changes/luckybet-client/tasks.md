# LuckyBet Client Tasks — Change `luckybet-client`

> Convención: numeración jerárquica por fase; cada tarea completable en una sesión.
> Referencias `S#` a escenarios de `spec.md` y `ADR-#` a decisiones de `design.md`.

## Fase 0 — Preparación

- [ ] 0.1 Confirmar con el negocio/proveedor la semántica del monto del panel (desbloquea Fase 3). Ref: Unresolved Questions.
- [ ] 0.2 Definir valor definitivo de `LUCKYBET_BALANCE_FACTOR` y guardarlo en `.env.example` con comentario. Ref: ADR-3.
- [ ] 0.3 Acordar host del panel (default `ag.luckybet.site`) y credenciales de operador para non-prod/prod. Ref: ADR-2.

## Fase 1 — Adaptador de API de jugadores (JSON)

- [ ] 1.1 Crear `ports/driven/ForPlayersApi.ts` con los métodos de diseño (login, getProfile) y su `*.spec.ts` de contrato. Ref: S-Jugadores.
- [ ] 1.2 Implementar `adapters/driven/players-api.client.ts`: `POST` JSON con `version`/`domain` fijos desde env; timeout `LUCKYBET_TIMEOUT_MS`. Ref: S-Transporte, ADR-1.
- [ ] 1.3 Mapear errores: `authorize_error` → 401, `password_not_correct` → 401, red/timeout → 502/504. Test con mocks.
- [ ] 1.4 Implementar en core `verifyPlayerToken(token)`: devuelve perfil o `null`; **sin cache de validez**. Ref: S-Verificación.
- [ ] 1.5 Test de integración manual contra `api.luckybet.site` (login serrot99 + `terminalInfo`): token válido e inválido.
- [ ] 1.6 Actualizar `.env.example` y `README`/`API.md` con la sección del cliente jugadores.

## Fase 2 — Adaptador del panel (lectura)

- [ ] 2.1 Crear `ports/driven/ForPanelApi.ts` y spec de contrato. Ref: S-Panel.
- [ ] 2.2 Implementar `adapters/driven/panel-session.store.ts`: captura de la **2ª** cookie `PHPSESSID`, TTL configurable.
- [ ] 2.3 Implementar `adapters/driven/panel-api.client.ts` (login automático, re-login + 1 reintento, logout). Ref: S-Autenticación panel, ADR-2.
- [ ] 2.4 `searchPlayer(login)`: `POST area=search&response=js`, body form-urlencoded (`URLSearchParams`), paginación `page`. Ref: S-Búsqueda.
- [ ] 2.5 `getBalance(userId, from?, to?)`: `GET area=balance&response=js` con fechas URL-encoded; normalizar `currencies`/`operationsData`/`sum`. Ref: S-Balance.
- [ ] 2.6 Tests unitarios (mocks de fetch) + integración real (búsqueda `serrot99`, saldo `8744343`).
- [ ] 2.7 Documentar en `API.md` los endpoints de lectura expuestos del módulo.

## Fase 3 — Escrituras con idempotencia (crédito/débito)

> **Bloqueada** hasta 0.1/0.2 (factor confirmado).

- [ ] 3.1 Entidad `LuckyBetOperation` + migración con `operation_id` único. Ref: S-Persistencia, ADR-4.
- [ ] 3.2 Core `creditPlayer`/`debitPlayer`: factor en core (`amount_real = amount × LUCKYBET_BALANCE_FACTOR`), validación previa (jugador existe, monto > 0). Ref: S-Crédito, ADR-3.
- [ ] 3.3 Extracción de `operation_id` desde `printUrl` y registro en BD **antes** de responder; rechazo de duplicados. Ref: S-Crédito, ADR-4.
- [ ] 3.4 Reconciliación post-operación con `getBalance` (saldo esperado = inicial ± amount_real). Ref: S-Crédito.
- [ ] 3.5 Feature flag `LUCKYBET_CREDIT_ENABLED` (default false) aplicada en el controlador. Ref: Security.
- [ ] 3.6 Test de integración **neto cero**: crédito 2000 + débito 2000 en cuenta de prueba con verificación por panel y por `terminalInfo`.

## Fase 4 — Persistencia y endpoints

- [ ] 4.1 Entidad `LuckyBetPlayer` + migración (`casino_id` único). Ref: S-Persistencia, ADR-5.
- [ ] 4.2 Core `findPlayer`, `getPlayerBalance`, `syncPlayerFromToken` (upsert jugador). Ref: S-Persistencia.
- [ ] 4.3 Controlador `luckybet.controller.ts` con DTOs Zod y rutas de diseño. Ref: design Endpoints.
- [ ] 4.4 Guards de rol en `credit`/`debit` (solo `SUPER_ADMIN`) + rate limiting + auditoría. Ref: S-Seguridad.
- [ ] 4.5 Swagger de los nuevos endpoints (convención `main.ts`).
- [ ] 4.6 Tests E2E (401 sin rol, 400 montos inválidos, 200 ok) + cobertura ≥ 80 %.

## Fase 5 — Endurecimiento

- [ ] 5.1 Store de sesión a Redis si multi-instancia (evaluar). Ref: ADR-2.
- [ ] 5.2 Métricas básicas (éxito/fallo por llamada, latencia, reintentos de sesión).
- [ ] 5.3 Timeouts y retry policy finos por operación (lectura vs escritura).
- [ ] 5.4 Revisión de secretos: rotación de credenciales, secret manager (si aplica).
- [ ] 5.5 Archivado del change (spec-driven: aplicar deltas y archivar) tras validación.