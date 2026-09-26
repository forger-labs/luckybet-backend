# Plan Refinado: Validación Estricta de `GAME_PLAY`, `totalBet` y Edición de Pasos en Misiones

Este documento detalla el plan técnico corregido y enriquecido con las reglas de negocio precisas solicitadas:

1. **Uso estricto de `totalBet` (apuesta real de casino)** en lugar de `wager`.
2. **Validación de Apuesta Mínima por Juego (`minBet`)**:
   - Para que un juego califique en el historial del jugador, su `totalBet` debe ser `>= minBet`.
   - Deben cumplirse al menos `requiredUniqueGames` que alcancen esa apuesta mínima.
   - Si se especifica un `gameId`, la meta de juegos requeridos es estrictamente **1**.
3. **Edición de Pasos (`missionSteps`) en `PATCH /missions/:id` (Solo en estado `INACTIVE`)**:
   - **NO se permite editar la imagen principal** en este endpoint (las imágenes se manejan exclusivamente en `POST /:id/image` y `DELETE /:id/image`).
   - Se incorpora a nivel de schema la misma validación de integridad de `createMissions`:
     - **Regla A**: `gameId` y `provider` son **mutuamente excluyentes** (no pueden existir al mismo tiempo).
     - **Regla B**: Si existe un `gameId`, `minUniqueGames` **no puede ser mayor a 1**.

---

## 1. Reglas Técnicas Detalladas

### 1.1 Validación de `GAME_PLAY` en `MisionesCore.verifyAutoStep`
- **Ventana temporal**: Días transcurridos desde `um.startedAt`:
  ```typescript
  const now = Date.now();
  const startedAt = um.startedAt ? new Date(um.startedAt).getTime() : now;
  const days = Math.max(1, Math.ceil((now - startedAt) / (1000 * 60 * 60 * 24)));
  ```
- **Llamada hacia `panelApi.getLastPlayedGames`**:
  ```typescript
  const history = await this.panelApi.getLastPlayedGames(playerId, {
      provider: targetConfig?.provider,
      gameName: targetConfig?.gameId,
      days,
      token,
  });
  ```
- **Meta de juegos únicos requeridos**:
  ```typescript
  const requiredUniqueGames = targetConfig?.gameId ? 1 : (targetConfig?.minUniqueGames ?? 1);
  ```
- **Filtrado por Apuesta Mínima (`minBet` sobre `totalBet` / `totalBetInPeriod`)**:
  ```typescript
  const minBet = targetConfig?.minBet ?? 0;
  // Cada juego en history.games debe cumplir con la apuesta mínima requerida
  const qualifyingGames = history.games.filter(g => (g.totalBetInPeriod ?? 0) >= minBet);
  ```
- **Verificación**:
  - Si `qualifyingGames.length < requiredUniqueGames`:
    ```typescript
    throw new BadRequestException(
        `Aun no cumples el requisito: se requieren ${requiredUniqueGames} juego(s) con apuesta mínima de ${minBet} y tienes ${qualifyingGames.length}`,
    );
    ```

---

### 1.2 Reglas de Validación en `gamePlayStepConfigSchema`
Tanto para creación como para edición (`createMissionSchema` y `updateMissionSchema`), `gamePlayStepConfigSchema` se blinda con `refine`:
1. **Exclusión mutua**: No pueden enviarse `provider` y `gameId` simultáneamente en el mismo paso.
2. **Coherencia de juegos únicos**: Si se envía `gameId`, `minUniqueGames` no puede ser mayor a 1.

---

### 1.3 Edición de Pasos en `PATCH /missions/:id` (`updateMission`)
- En `updateMissionSchema`:
  - Se remueve `imageUrl` del schema de actualización (no se puede editar la imagen en el patch, se usan los endpoints dedicados de imagen).
  - Se agrega `missionSteps?: CreateMissionStepDto[]`.
- En `MisionesCore.updateMission`:
  - Valida la regla de inmutabilidad: solo se permite editar si `mission.status === MissionStatus.INACTIVE`.
- En `MissionRepoService.updateMission`:
  - Si viene `missionSteps`:
    1. Ejecuta una transacción TypeORM (`manager.transaction`).
    2. Actualiza las columnas de la tabla `missions`.
    3. Elimina los pasos existentes asociados a la misión (`manager.delete(MissionStep, { missionId: id })`).
    4. Crea e inserta los nuevos pasos con su `stepOrder`, `type`, `content` y `targetConfig`.
    5. Retorna la misión con sus nuevos pasos.

---

## 2. Matriz de Cambios por Archivo

| Archivo | Tipo de Cambio | Responsabilidad |
| :--- | :--- | :--- |
| `src/misiones/app/dto/mission.schema.ts` | Modificación | Aplicar `.refine()` en `gamePlayStepConfigSchema` (mutua exclusión `provider`/`gameId` y `gameId => minUniqueGames <= 1`). |
| `src/misiones/app/dto/update-mission.dto.ts` | Modificación | Remover `imageUrl` y agregar `missionSteps?: CreateMissionStepDto[]`. |
| `src/misiones/ports/driver/ForDatabaseMissions.ts` | Modificación | Extender `UpdateMissionData` con `missionSteps?: CreateMissionStepInput[]`. |
| `src/misiones/adapters/driven/MissionRepo.service.ts` | Modificación | Transaccionar el reemplazo atómico de `steps` en `updateMission`. |
| `src/misiones/app/misionesCore.ts` | Modificación | Implementar validación de `minBet` sobre `totalBetInPeriod` y meta de 1 en `verifyAutoStep`. |
| Tests Unitarios (`misionesCore.spec.ts`) | Modificación | Pruebas de `minBet`, exclusión mutua y actualización de pasos. |
| Control de Calidad | Verificación | `biome lint`, `pnpm test`, `build:clean`, `build`. |
| `docs/endpoints-api-reference.md` | Actualización (Post-QA) | Reflejar los contratos exactos de `PATCH /missions/:id` y `verifyAutoStep`. |

---

## 3. Plan de Tareas Paso a Paso (Checklist)

- [ ] **Paso 1: Blindaje de Validación en `gamePlayStepConfigSchema`**:
  - Validar exclusión mutua de `provider` y `gameId`.
  - Validar que si hay `gameId`, `minUniqueGames` no sea mayor a 1.
- [ ] **Paso 2: Schema de Actualización (`update-mission.dto.ts`)**:
  - Quitar `imageUrl`.
  - Agregar `missionSteps` opcional validado con `createMissionStepSchema`.
- [ ] **Paso 3: Reemplazo Atómico de Pasos en `MissionRepoService`**:
  - Si `missionSteps` está presente en `updateMission`, borrar pasos anteriores e insertar los nuevos dentro de la transacción.
- [ ] **Paso 4: Validación de `minBet` con `totalBetInPeriod` en `MisionesCore`**:
  - Calcular `days` desde `um.startedAt`.
  - Fijar meta en 1 si hay `gameId`, o en `minUniqueGames` si es proveedor.
  - Filtrar juegos con `g.totalBetInPeriod >= minBet`.
- [ ] **Paso 5: Pruebas Unitarias de `Misiones`**:
  - Crear y actualizar tests para verificar las nuevas reglas de apuesta mínima y edición de pasos.
- [ ] **Paso 6: Control de Calidad Estricto (@RULES.md)**:
  - `pnpm exec biome lint src/`
  - `pnpm test`
  - `pnpm run build:clean`
  - `pnpm run build`
- [ ] **Paso 7: Actualización de Documentación Post-QA**:
  - Actualizar `docs/endpoints-api-reference.md` con los contratos refinados.
