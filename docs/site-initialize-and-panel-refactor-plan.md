# Plan de Refactorización: `siteInitialize`, `getGameList` y Desacoplamiento del Controlador de Panel

Este documento establece el plan de arquitectura para:
1. Integrar el comando `siteInitialize` en `UserPanelService` para obtener el `before_token` público y permitir consultar `gameList` sin sesión de jugador.
2. Gestionar la caché de `before_token` y `gameList` en Redis con TTL de 24 horas (o más), evitando llamadas innecesarias al panel de LuckyBet.
3. Desacoplar `PanelController` (`src/panelApi/adapters/driver/luckyPanel.controller.ts`) para que inyecte y consuma `FOR_PANEL_API_CORE` (`ForPanelApiCore`) en lugar de `FOR_USER_PANEL` (respetando la regla de arquitectura que prohíbe a los controladores depender de puertos driven).
4. Hacer público el endpoint `GET /api/v1.0/panel/games` retirando la necesidad del `PlayerTokenGuard` y `@CurrentToken()`.
5. Ejecutar la suite completa de calidad según `@RULES.md` y actualizar la documentación post-QA.

---

## 1. Diagnóstico y Arquitectura

### 1.1 Inyección Incorrecta en `PanelController`
- **Problema**: `PanelController` inyectaba `@Inject(FOR_USER_PANEL) private readonly userPanel: ForUserPanel`. Los controladores (drivers) nunca deben hablar con adaptadores driven de infraestructura; deben interactuar exclusivamente con la capa de aplicación/dominio (`PanelApiCore` vía `ForPanelApiCore`).
- **Solución**:
  - Exponer `getGameList(): Promise<LuckyBetGameItem[]>` en `ForPanelApiCore` y en `PanelApiCore`.
  - Inyectar `@Inject(FOR_PANEL_API_CORE) private readonly panelApi: ForPanelApiCore` en `PanelController`.

### 1.2 Flujo de Obtención de Juegos con `siteInitialize`
LuckyBet permite obtener el catálogo de juegos (`cmd: "gameList"`) sin autenticación de jugador si se le suministra el `before_token`:
1. `siteInitialize`:
   - Payload enviado: `{"cmd": "siteInitialize", "domain": "https://luckybet.site", "version": 9}`.
   - Respuesta: `{ status: "success", content: { before_token: "...", ... } }`.
2. Se extrae `before_token` y se guarda en caché de Redis con una clave (ej: `luckybet:before_token`) con TTL de 24 horas (`86400` segundos).
3. `getGameList()`:
   - Verifica primero si `LUCKYBET_GAME_CATALOG_CACHE_KEY` está en Redis. Si existe, lo retorna de inmediato sin llamadas remotas.
   - Si no existe en caché:
     - Obtiene un `before_token` válido (desde Redis o llamando a `siteInitialize`).
     - Llama a `executeCommand('gameList', { token: beforeToken })`.
     - Si la llamada con el token expiró o falla, invalida el `before_token`, refresca llamando a `siteInitialize` y reintenta `gameList`.
     - Guarda el catálogo de juegos en Redis con TTL de 24 horas (`86400` segundos).

### 1.3 `PanelController.gameList`
- El endpoint `GET /api/v1.0/panel/games` pasa a ser público:
  - Se remueve `@CurrentToken()` y cualquier dependencia de sesión de jugador.
  - Retorna `LuckyBetGameItemResponseDTO`.

---

## 2. Matriz de Cambios por Archivo

| Archivo | Tipo de Cambio | Responsabilidad |
| :--- | :--- | :--- |
| `src/panelApi/types/userPanel.types.ts` | Modificación | Agregar interfaces `LuckyBetSiteInitializeContent` y `LuckyBetSiteInitializeResponse`. |
| `src/panelApi/ports/forUserPanel.port.ts` | Modificación | Agregar `siteInitialize(): Promise<string>` y firma `getGameList(token?: string)`. |
| `src/panelApi/adapters/driven/userPanel.service.ts` | Modificación | Implementar `siteInitialize()` con fallback y caché de `before_token`, y adaptar `getGameList` para usar el token obtenido automáticamente. |
| `src/panelApi/ports/forPanelApiCore.port.ts` | Modificación | Agregar `getGameList(): Promise<LuckyBetGameItem[]>`. |
| `src/panelApi/app/panelApiCore.ts` | Modificación | Implementar `getGameList()` delegando en `this.userPanel.getGameList()`. |
| `src/panelApi/adapters/driver/luckyPanel.controller.ts` | Modificación | Inyectar `FOR_PANEL_API_CORE` en vez de `FOR_USER_PANEL`, eliminar `@CurrentToken()` y llamar a `panelApi.getGameList()`. |
| `src/panelApi/__tests__/userPanel.service.spec.ts` y `panelApiCore.spec.ts` | Actualización | Actualizar tests unitarios y mocks. |
| `docs/endpoints-api-reference.md` | Actualización Post-QA | Reflejar que `GET /api/v1.0/panel/games` es público y no requiere `Player Token`. |

---

## 3. Plan de Tareas Paso a Paso (Checklist)

- [ ] **Paso 1: Tipos y Puertos de `UserPanel`**:
  - Declarar `siteInitialize` y tipos de respuesta en `userPanel.types.ts` y `forUserPanel.port.ts`.
- [ ] **Paso 2: Implementación en `UserPanelService`**:
  - Implementar comando `siteInitialize`, extracción de `before_token` y caché en Redis.
  - Asegurar que `getGameList()` use el `before_token` cuando no se reciba un token explícito y cachee el catálogo por 24 horas.
- [ ] **Paso 3: Exposición en `PanelApiCore` y Puerto `ForPanelApiCore`**:
  - Agregar `getGameList()` en `ForPanelApiCore` y en `PanelApiCore`.
- [ ] **Paso 4: Refactorización de `PanelController`**:
  - Reemplazar `FOR_USER_PANEL` por `FOR_PANEL_API_CORE`.
  - Hacer público el endpoint `GET /api/v1.0/panel/games` sin `@CurrentToken()`.
- [ ] **Paso 5: Pruebas Unitarias**:
  - Actualizar pruebas en `src/panelApi/__tests__/`.
- [ ] **Paso 6: Control de Calidad Estricto (@RULES.md)**:
  - `pnpm exec biome lint src/`
  - `pnpm test`
  - `pnpm run build:clean`
  - `pnpm run build`
- [ ] **Paso 7: Actualización de Documentación Post-QA**:
  - Modificar la sección de `GET /api/v1.0/panel/games` en `docs/endpoints-api-reference.md`.
