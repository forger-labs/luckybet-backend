# Plan Integral: Filtros y Ordenamiento en `listMissions` y `getPlayerMissions`

Este documento establece el plan de arquitectura para dotar de filtros dinámicos, ordenamiento temporal (`ASC`/`DESC`) y tipado estricto con Zod a:
1. `GET /api/v1.0/missions` (`MissionsController.findAll` / `MisionesCore.listMissions`).
2. `GET /api/v1.0/missions/my-missions` (`PlayerMisionesController.getPlayerMissions` / `MisionesCore.getPlayerMissions`).

---

## 1. Alcance de los Filtros y Ordenamiento

### A. Para el Catálogo General de Misiones (`listMissions` / `GET /missions`)
- **`title`** *(string, opcional)*: Búsqueda parcial (`ILike %title%`).
- **`type`** *(enum: `DAILY` | `WEEKLY` | `FIXED`, opcional)*: Tipo de misión.
- **`status`** *(enum: `INACTIVE` | `ACTIVE` | `COMPLETED` | `CANCELLED`, opcional)*: Estado de la plantilla.
- **`roomId`** *(number, opcional)*: Sala promocional asociada.
- **`minCoins` / `maxCoins`** *(number, opcional)*: Rango de monedas (`Between`, `>=`, `<=`).
- **`minExperience` / `maxExperience`** *(number, opcional)*: Rango de experiencia otorgada.
- **`orderDirection`** *(enum: `ASC` | `DESC`, default: `DESC`)*: Orden por fecha de creación (`created_at`).
- **Paginación estándar**: `take` *(default 50, max 100)* y `skip` *(default 0)*.

### B. Para las Misiones del Jugador (`getPlayerMissions` / `GET /missions/my-missions`)
- **`status`** *(enum `UserMissionStatus`, opcional)*: `"IN_PROGRESS"` | `"COMPLETED"` | `"EXPIRED"` | `"CANCELLED"`.
- **`missionId`** *(number, opcional)*: Filtrar por plantilla de misión específica.
- **`orderDirection`** *(enum: `ASC` | `DESC`, default: `DESC`)*: Orden por fecha de inicio (`created_at` o `startedAt`).
- **Paginación estándar**: `take` *(default 50, max 100)* y `skip` *(default 0)*.

---

## 2. Matriz de Cambios por Archivo

| Archivo | Tipo de Cambio | Responsabilidad |
| :--- | :--- | :--- |
| `src/misiones/app/dto/mission.schema.ts` | Modificación | 1) Definir `missionFilterSchema`, `MissionFilter` y `MissionFilterDto`. <br>2) Definir `userMissionFilterSchema`, `UserMissionFilter` y `UserMissionFilterDto`. |
| `src/misiones/ports/driver/ForDatabaseMissions.ts` | Modificación | Firma `getMissions(filter?: MissionFilter)`. |
| `src/misiones/ports/driver/ForDatabaseUserMissions.ts` | Modificación | Firma `findByPlayer(playerId: number, filter?: UserMissionFilter)`. |
| `src/misiones/ports/driven/ForManageMissions.ts` | Modificación | Firma `listMissions(filter?: MissionFilter)`. |
| `src/misiones/ports/driven/ForManagePlayerMissions.ts` | Modificación | Firma `getPlayerMissions(playerId: number, filter?: UserMissionFilter)`. |
| `src/misiones/adapters/driven/MissionRepo.service.ts` | Modificación | Construir `FindOptionsWhere<Mission>` y aplicar `order: { created_at: orderDirection }`. |
| `src/misiones/adapters/driven/UserMissionRepo.service.ts` | Modificación | Construir `FindOptionsWhere<UserMission>` (`status`, `missionId`) y aplicar `order: { created_at: orderDirection }`. |
| `src/misiones/app/misionesCore.ts` | Modificación | Recibir `filter` en `listMissions` y `getPlayerMissions`, calculando `limit` y `skip` dinámicamente en los metadatos. |
| `src/misiones/adapters/driver/misiones.controller.ts` | Modificación | Recibir `@Query() filter: MissionFilterDto` en `findAll` y registrar decoradores Swagger. |
| `src/misiones/adapters/driver/player-misiones.controller.ts` | Modificación | Recibir `@Query() filter: UserMissionFilterDto` en `getPlayerMissions` y registrar decoradores Swagger. |
| Tests Unitarios | Actualización | Adaptar tests de `misiones.controller.spec.ts` y `player-misiones.controller.spec.ts`. |
| `docs/endpoints-api-reference.md` | Actualización (Post-QA) | Documentar query params y estructuras JSON de ambos endpoints **después de pasar todos los checks de calidad**. |

---

## 3. Plan de Ejecución Paso a Paso

1. **Paso 1: Schemas y DTOs de Filtrado y Ordenamiento**:
   - Agregar `missionFilterSchema` y `userMissionFilterSchema` en `src/misiones/app/dto/mission.schema.ts`.
2. **Paso 2: Actualización de Contratos e Interfaces (Puertos)**:
   - Modificar las firmas en `ForDatabaseMissions`, `ForDatabaseUserMissions`, `ForManageMissions` y `ForManagePlayerMissions`.
3. **Paso 3: Repositorios TypeORM (`MissionRepoService` y `UserMissionRepoService`)**:
   - Implementar construcción dinámica de `where` y `order` por `created_at` en ambos repositorios.
4. **Paso 4: Capa de Dominio / Core (`MisionesCore`)**:
   - Adaptar `listMissions` y `getPlayerMissions` para propagar los filtros y calcular la paginación.
5. **Paso 5: Controladores y Swagger**:
   - Actualizar `MissionsController.findAll` y `PlayerMisionesController.getPlayerMissions` conectándolos con sus respectivos DTOs.
6. **Paso 6: Control de Calidad Estricto (@RULES.md)**:
   - `pnpm exec biome lint src/`
   - `pnpm test` (Suite completa de 27 suites y 291+ tests en verde)
   - `pnpm run build:clean`
   - `pnpm run build`
7. **Paso 7: Actualización de Documentación en `docs/endpoints-api-reference.md`**:
   - Una vez aprobado el control de calidad, documentar exhaustivamente los query params, tipos y payloads de ambos endpoints.
