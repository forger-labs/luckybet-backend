# LuckyBet Client Spec — Change `luckybet-client`

## ADDED Capability: Integración con la API de jugadores

### Requirements

#### Scenario: Login de jugador contra el casino
- **GIVEN** el backend tiene credenciales de un jugador del casino
- **WHEN** se ejecuta el login contra `api.luckybet.site/?act=command&area=cmd` con el comando `authorization`
- **THEN** el sistema MUST devolver un token opaco si `status == "success"`
- **AND** el sistema MUST mapear `password_not_correct` a un error 401 sin exponer detalle de credenciales

#### Scenario: Verificación de la validez de un token
- **GIVEN** un token proporcionado por el frontend (guardado como `ig_token` en el navegador del jugador)
- **WHEN** el sistema llama a `terminalInfo` con el token en el body JSON (`version: 9`, `domain: "luckybet.site"`)
- **THEN** si `status == "success"` y `content.id` existe, el sistema MUST devolver el jugador con su id canónico, `login`, `name`, `cash` y `currency`
- **AND** si la respuesta es `errorCode == "authorize_error"`, el sistema MUST rechazar con 401 (token inválido, expirado o revocado)
- **AND** el sistema MUST NOT cachear la validez indefinidamente (los tokens se revocan con `userLogout` y expiran)

#### Scenario: Transporte del adaptador de jugadores
- **GIVEN** una llamada al adaptador `ForPlayersApi`
- **WHEN** se construye el request
- **THEN** el método HTTP MUST ser `POST` con `Content-Type: application/json`
- **AND** el body MUST incluir `version` y `domain` en todas las llamadas
- **AND** el token MUST viajar en el body JSON (nunca en query ni en headers) — comportamiento verificado de la plataforma

## ADDED Capability: Integración con el panel admin/agente

### Requirements

#### Scenario: Autenticación en el panel
- **GIVEN** credenciales de operador configuradas en env (`LUCKYBET_ADMIN_LOGIN`/`PASSWORD`)
- **WHEN** el adaptador necesita una sesión
- **THEN** el sistema MUST hacer `POST index.php?act=admin&area=login` con body **form-urlencoded**
- **AND** el sistema MUST capturar la **segunda** cookie `PHPSESSID` (comportamiento observado del panel)
- **AND** el sistema MUST detectar sesión expirada (`{"noMain":true,...,"redirect":"login"}` o `302`) y re-loguear automáticamente con **un** reintento
- **AND** las credenciales y el `PHPSESSID` MUST NOT aparecer en logs

#### Scenario: Búsqueda global de jugador
- **GIVEN** un login a buscar (ej.: `serrot99`)
- **WHEN** el sistema ejecuta `POST ag.luckybet.site/index.php?act=admin&area=search&response=js` con body form-urlencoded (`search_login=<login>&page=<n>`)
- **THEN** el sistema MUST devolver el listado `users[]` con `id`, `login`, `group`, `name` y `create`
- **AND** paginar correctamente usando `page`, `next_page_enable`, `prev_page_enable`, `page_start_num`, `page_end_num`
- **AND** la búsqueda MUST usar POST (con GET el panel responde `users: []` — verificado)

#### Scenario: Consulta de balance y movimientos
- **GIVEN** el id canónico de un jugador y un rango de fechas opcional
- **WHEN** el sistema ejecuta `GET area=balance&response=js` con `id`, `from`, `to`, `limit`
- **THEN** devolverá saldo por moneda (`currencies`), `operationsData[]` (id, operation, cash, cash_before, datetime, system, initiator, ip, …), y totales (`sum`)
- **AND** las fechas MUST ir URL-encoded en la query

## ADDED Capability: Operaciones de crédito y débito (balances)

### Requirements

#### Scenario: Crédito de fichas (recompensa de misión)
- **GIVEN** un jugador autenticado y una recompensa pendiente
- **WHEN** el sistema ejecuta `POST area=balance&response=js&type=frame&printing=true&id=<userId>` con body form-urlencoded (`balance_currency`, `amount`, `send=true`, `all=false`, `operation=in`)
- **THEN** el sistema MUST aplicar el factor configurable (`LUCKYBET_BALANCE_FACTOR`, default `2`) al calcular el efecto real sobre el saldo
- **AND** el sistema MUST registrar la operación con su `operation_id` (extraído de `printUrl`) en `luckybet_operations` como clave única
- **AND** el sistema MUST NOT reintentar una operación ya registrada (idempotencia)
- **AND** el sistema MUST verificar el resultado (`successMessage`) y reconciliar el saldo con una consulta posterior

#### Scenario: Débito de fichas
- **GIVEN** una operación de descuento aprobada
- **WHEN** el sistema ejecuta la misma operación con `operation=out`
- **THEN** se aplican las mismas garantías de factor, idempotencia y reconciliación que en el crédito
- **AND** el débito SOLO es invocable por usuarios con rol `SUPER_ADMIN` del backoffice y montos acotados (validación Zod + límite configurable)

#### Scenario: Seguridad de las escrituras
- **GIVEN** un request de crédito/débito
- **WHEN** se procesa en el controlador
- **THEN** el guard de rol MUST denegar a roles no autorizados
- **AND** la validación Zod MUST rechazar `amount <= 0`, moneda no soportada o montos fuera de tope
- **AND** cada escritura MUST quedar registrada en auditoría (usuario solicitante del backoffice + `initiator` del panel)

## ADDED Capability: Persistencia local del jugador

### Requirements

#### Scenario: Almacenamiento del jugador del casino
- **GIVEN** un token válido verificado vía `terminalInfo`
- **WHEN** el sistema autentica al jugador
- **THEN** el jugador MUST almacenarse/actualizarse en `luckybet_players` con `casino_id` único (id canónico), `login`, `name`, `currency` y `last_sync_at`
- **AND** el `casino_id` MUST ser el mismo que usa el panel (`uid`/`id`) para permitir cruzar saldos y movimientos

#### Scenario: Trazabilidad de operaciones
- **GIVEN** una operación de balance ejecutada
- **WHEN** se persiste en `luckybet_operations`
- **THEN** se guardan `operation_id` (único), `player_id`, `type` (in/out), `amount_requested`, `amount_real`, `initiator`, `status` y `created_at`
- **AND** la tabla MUST tener constraint único sobre `operation_id` para garantizar idempotencia a nivel de base de datos