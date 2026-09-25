# Tareas: Módulo LevelRewards y Aislamiento de Recompensas por Nivel

- [ ] Task 1: Revertir la transferencia automática de sala en `PlayerRepoService.addExperienceAndRecalculateLevel`.
- [ ] Task 2: Crear la estructura del módulo `src/levelRewards` (entidad `LevelReward`, schemas DTO, puertos).
- [ ] Task 3: Implementar `LevelRewardRepoService` con soporte de bloqueo atómico (`acquireClaimLock`, actualización a `PROCESSING`).
- [ ] Task 4: Implementar `LevelRewardsCore` con el protocolo de reclamo blindado (transferencia previa a sala del nivel, crédito de fichas y retorno obligatorio a sala base).
- [ ] Task 5: Implementar `LevelRewardsController` para reclamo de jugador (`POST /api/v1.0/level-rewards/:levelId/claim`) y resolución de reclamos dudosos por admin.
- [ ] Task 6: Integrar `LevelRewardsModule` en `AppModule` y generar automáticamente el `LevelReward` al subir de nivel en `PlayerRepoService`.
- [ ] Task 7: Escribir pruebas unitarias exhaustivas en `src/levelRewards/app/levelRewardsCore.spec.ts`.
- [ ] Task 8: Validar build (`pnpm build`), linter (`npx biome lint src/`) y suite de pruebas (`pnpm test`).
