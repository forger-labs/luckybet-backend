---
id: luckybet-client
title: "Integrar cliente LuckyBet (API de jugadores + panel admin)"
status: proposed
---

# Proposal: Cliente LuckyBet para `luckybet-premios-backend`

## Summary

Integrar al backend dos clientes HTTP hacia la plataforma LuckyBet:

1. **API de jugadores** (`api.luckybet.site/?act=command&area=cmd`): login de jugadores, verificación de tokens y perfil (JSON).
2. **Panel admin/agente** (`ag.luckybet.site/index.php?act=admin&area=...`): búsqueda global de jugadores, consulta de saldos/movimientos y operaciones de crédito/débito (form-urlencoded + sesión PHP).

El objetivo de negocio es poder **verificar la validez del access token del casino** y **almacenar información del jugador** para el módulo de misiones de GanaYa, así como (fase posterior, sujeta a confirmación) abonar fichas por recompensas.

La integración se basa en la investigación documentada en `luckybet-login-report.md`, `luckybet-admin-report.md` y `luckybet-api-guide.md`, y en el diseño contenido en `luckybet-client-plan.md`.

## Motivation

- El módulo de autenticación de LuckyBet Misiones debe iniciar sesión usando la API del panel de LuckyBet (el backend del casino **no está bajo nuestro control**, por lo que la integración debe ser resiliente a cambios suyos).
- El token del casino es **opaco y sin verificación offline** (no es JWT): solo puede validarse llamando a `terminalInfo`. Hoy el backend no tiene ninguna pieza que lo haga.
- Para almacenar información del usuario (misiones, niveles, recompensas) se necesita el **id canónico del jugador** (`terminalInfo.id` = `uid` del panel) y sus datos (login, moneda, saldo).
- El panel exige **sesión PHP** y **form-urlencoded**, distinto de la API de jugadores (JSON): se necesita un cliente específico con cookie jar y re-login automático.

## User Stories

- **Como** sistema backend de misiones, **quiero** verificar que un token presentado por el usuario es válido en el casino **para** autenticarlo y almacenar su información.
- **Como** operador del sistema, **quiero** buscar un jugador en el panel por su login **para** localizar su id canónico.
- **Como** operador, **quiero** consultar el saldo y movimientos de un jugador **para** validar su actividad (apuestas, cargas) en el módulo de niveles/misiones.
- **Como** sistema, **quiero** cargar/retirar fichas con idempotencia y trazabilidad **para** abonar recompensas sin duplicar operaciones.

## Success Metrics

- `status` real de `terminalInfo` devuelto y mapeado correctamente (token válido vs `authorize_error`).
- Búsqueda global de jugador funcionando contra `ag.luckybet.site` (validada con `serrot99` → id `8744343`).
- Operaciones de crédito/débito con discriminador `operation_id` único: **cero duplicados** ante reintentos.
- Cobertura de tests ≥ 80 % (regla del repositorio) y `pnpm test` / `pnpm build` verdes.

## Out of Scope (No-Goals)

- No se reemplaza el JWT propio del backend (`src/auth`): el token de LuckyBet es una identidad de casino, no la sesión del panel/backoffice.
- No se implementan pagos, retiros de dinero real ni automatización de retiros de premios (débitos) sin aprobación explícita.
- No se migra la sesión PHP a sistema propio de refresh; el cliente gestiona el `PHPSESSID` internamente.
- Fuera de alcance la automatización de **cargas** mientras no se confirme la semántica del monto (riesgo: factor ×2, ver `Unresolved Questions`).

## Unresolved Questions

1. **Semántica del monto en el panel (factor ×2).** Verificado empíricamente que `amount=2000` mueve ±4000 de saldo real. MUST resolverse (confirmación del proveedor o acuerdo del negocio) antes de Fase 3 (escrituras). Se implementa con constante configurable `LUCKYBET_BALANCE_FACTOR` (default `2`).
2. **Host del panel para operaciones:** `ag.luckybet.site` (búsqueda global y operaciones verificadas) vs `admin.luckybet.site` (restringido por red del operador). Se adopta `ag.luckybet.site` como default, configurable.
3. **TTL real de la sesión PHP** (medido en minutos): se configura `LUCKYBET_SESSION_TTL_MS` por debajo del límite real y se re-loguea automáticamente.
4. **¿El backend emite tokens** (login con password del jugador) o solo valida tokens provistos por el frontend? Recomendado: solo validar tokens provistos (el password del jugador nunca debe almacenarse).

## Rollback Plan

- El cambio es puramente aditivo: nuevos módulos (`src/luckybet/*`) y tablas (migraciones). No modifica flujos existentes.
- Rollback = revertir el commit del change y (si se aplicó) la migración `luckybet_operations`/`luckybet_players`.
- Las operaciones de escritura quedan detrás de guards de rol y se pueden desactivar con una feature flag en env (ver design).
- Se respetan los límites hexagonales existentes (`ports/`/`adapters/`); no se tocan contratos de otros módulos.