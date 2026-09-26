# Plan de Implementación: Endpoint de Proveedores de Juegos (`GET /api/v1.0/panel/providers`)

Este documento establece el diseño y arquitectura para exponer la lista deduplicada de proveedores de juegos en el módulo `src/panelApi`, extrayendo los proveedores a partir de la propiedad `label` (con fallback opcional en `provider`) de los juegos obtenidos de `gameList`.

---

## 1. Contexto y Requerimientos

- **Endpoint**: `GET /api/v1.0/panel/providers`
- **Naturaleza**: Público (igual que `GET /panel/games`, no requiere autenticación de jugador).
- **Origen de datos**: Catálogo de juegos obtenido desde `PanelApiCore.getGameList()`, el cual ya se encuentra optimizado con `siteInitialize` (`before_token`) y caché en Redis de 24 horas (`luckybet:catalog:game_list`).
- **Lógica de deduplicación**:
  - Cada item del catálogo puede tener `label` (y opcionalmente `provider`).
  - Se extrae prioritariamente `item.label` (limpiando espacios en blanco). Si no existe `label`, se puede considerar `item.provider` como fallback.
  - Se filtran valores vacíos/nulos/indefinidos.
  - Se deduplican insensible a mayúsculas/minúsculas pero preservando el nombre canónico y se ordenan alfabéticamente (`ASC`).
- **Estructura de respuesta**:
  ```json
  {
    "status": true,
    "message": "Proveedores obtenidos exitosamente",
    "data": [
      {
        "id": "pragmatic", // slug normalizado
        "name": "Pragmatic Play"
      },
      ...
    ]
  }
  ```
  O alternativamente un listado directo de nombres/objetos `{ id, name }` o `string[]` documentado con Zod (`LuckyBetProvidersResponseDTO`).

---

## 2. Matriz de Cambios por Archivo

| Archivo | Tipo de Cambio | Responsabilidad |
| :--- | :--- | :--- |
| `src/panelApi/app/dtos/game.schema.ts` | Modificación | Crear `LuckyBetProviderSchema`, `LuckyBetProvidersResponseSchema` y `LuckyBetProvidersResponseDTO`. |
| `src/panelApi/ports/forPanelApiCore.port.ts` | Modificación | Declarar `getProviders(): Promise<LuckyBetProvider[]>`. |
| `src/panelApi/app/panelApiCore.ts` | Modificación | Implementar `getProviders()` consumiendo `this.getGameList()`, deduplicando por `label` y ordenando alfabéticamente. |
| `src/panelApi/adapters/driver/luckyPanel.controller.ts` | Modificación | Agregar `@Get('/providers')` retornando la lista con Swagger decorado. |
| `src/panelApi/__tests__/panelApiCore.spec.ts` | Modificación | Agregar prueba unitaria para la deduplicación y ordenamiento de proveedores. |
| Control de Calidad | Verificación | `biome lint`, `pnpm test`, `build:clean`, `build`. |
| `docs/endpoints-api-reference.md` | Actualización (Post-QA) | Documentar el nuevo endpoint público `GET /api/v1.0/panel/providers` con su estructura JSON. |

---

## 3. Plan de Tareas Paso a Paso (Checklist)

- [ ] **Paso 1: Schemas y DTOs en `game.schema.ts`**:
  - Definir `LuckyBetProviderSchema` (`id: string, name: string`) y `LuckyBetProvidersResponseDTO`.
- [ ] **Paso 2: Puerto `ForPanelApiCore` y Core `PanelApiCore`**:
  - Agregar `getProviders()` en `ForPanelApiCore`.
  - Implementar en `PanelApiCore.getProviders()` extrayendo y deduplicando por `label`.
- [ ] **Paso 3: Controlador `PanelController`**:
  - Agregar `@Get('/providers')` decorado con `@ApiOkResponse({ type: LuckyBetProvidersResponseDTO })`.
- [ ] **Paso 4: Pruebas Unitarias**:
  - Añadir suite de prueba en `src/panelApi/__tests__/panelApiCore.spec.ts` para verificar la deduplicación y ordenamiento.
- [ ] **Paso 5: Control de Calidad Estricto (@RULES.md)**:
  - `pnpm exec biome lint src/`
  - `pnpm test`
  - `pnpm run build:clean`
  - `pnpm run build`
- [ ] **Paso 6: Documentación en `docs/endpoints-api-reference.md` (Post-QA)**:
  - Documentar el endpoint con ejemplo de respuesta JSON completa.
