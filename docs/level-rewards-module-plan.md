# Plan de Implementación: Módulo LevelRewards y Aislamiento de Recompensas por Nivel

Este documento establece la arquitectura y el plan para:
1. Revertir la transferencia indebida en el recálculo de nivel de `PlayerRepoService`.
2. Crear un módulo dedicado `src/levelRewards` (Ledger de premios por subir de nivel) que permita al usuario reclamar su premio cuando sube de nivel, aplicando la sala/bono asignada al nivel.

---

## 1. Corrección en `PlayerRepoService`
- **Error actual**: `addExperienceAndRecalculateLevel` transfería al jugador de sala en LuckyBet automáticamente al alcanzar los puntos de experiencia.
- **Corrección**:
  - Al subir de nivel (`newLevelId !== player.levelId`):
    - Se actualiza `player.levelId = targetLevel.id`.
    - **NO se transfiere al jugador de sala en LuckyBet**.
    - Se genera un registro en la tabla `level_rewards` con estado `PENDING` para que el jugador reclame su premio de ascenso cuando lo desee.

---

## 2. Arquitectura del Módulo `src/levelRewards`

```text
src/levelRewards/
├── adapters/
│   ├── driven/LevelRewardRepo.service.ts   # Bloqueo atómico y persistencia TypeORM
│   └── driver/level-rewards.controller.ts  # Endpoints Player (POST /:levelId/claim, GET /my-pending) y Admin
├── app/
│   ├── dto/level-reward.schema.ts          # Schemas Zod con zDateHelper
│   ├── entities/level-reward.entity.ts     # UNIQUE(playerId, levelId)
│   ├── constants.ts
│   └── levelRewardsCore.ts                 # Protocolo blindado de reclamo con retorno a sala base
├── ports/
│   ├── driven/ForManageLevelRewards.ts
│   └── driver/ForDatabaseLevelRewards.ts
└── levelRewards.module.ts
```

### 2.1. Entidad `LevelReward`
- `id`: PK incremental.
- `playerId`: ID del jugador.
- `levelId`: ID del nivel alcanzado.
- `coinsAmount`: Fichas que otorga el nivel (`level.coins`).
- `roomId`: Sala con bono que otorga el nivel (`level.roomId`, nullable).
- `status`: Enum `RewardStatus` (`PENDING`, `PROCESSING`, `CLAIMED`, `TIMEOUT_UNCERTAIN`).
- `externalOperationId`: ID de operación en LuckyBet.
- `resolvedByAdminId`: ID del administrador que auditó en caso de timeout.
- `claimedAt`: Fecha de reclamo (con `zDateHelper`).
- **Restricción Única**: `UNIQUE(playerId, levelId)` para que un nivel solo se cobre una vez por jugador.

---

## 3. Protocolo Blindado de Reclamo en `LevelRewardsCore`
Al ejecutar `claimLevelReward(levelId, playerId)`:
1. Bloqueo atómico en PostgreSQL cambiando a `PROCESSING`.
2. Identifica la sala base del jugador (`player.room`) y la sala del nivel (`reward.roomId`).
3. Si `reward.roomId` está presente:
   - Transfiere al jugador a esa sala en LuckyBet. Si falla -> `TIMEOUT_UNCERTAIN` (aborta crédito).
4. Carga las fichas en LuckyBet (`creditPlayer`). Si da timeout -> `TIMEOUT_UNCERTAIN`.
5. Retorna al jugador a su sala base. Si falla -> `TIMEOUT_UNCERTAIN`.
6. Si todo tiene éxito -> `status = CLAIMED`.

---

## 4. Checklist de Ejecución
1. [ ] Revertir la transferencia de sala en `PlayerRepoService.addExperienceAndRecalculateLevel`.
2. [ ] Crear `src/levelRewards` (entidad, DTOs, repo, core, controller y module).
3. [ ] Vincular `addExperienceAndRecalculateLevel` para generar automáticamente el `LevelReward` en `PENDING` al detectar ascenso de nivel.
4. [ ] Crear pruebas unitarias para `levelRewardsCore`.
5. [ ] Validar `npm run build`, `npx biome lint src/` y `npm test`.
