# ODD: Blindaje de Reclamo de Fichas, Retorno de Sala, Zod Dates y Desacoplamiento de Niveles

Este documento registra el seguimiento del plan de trabajo para:
1. Crear el helper reusable de fechas `zDateHelper` y aplicarlo en todos los schemas Zod.
2. Desacoplar `LevelsEntity` reemplazando `bonus` por `roomId`.
3. Implementar en `PlayerRepoService` la lógica de recálculo de nivel y actualización de sala al sumar experiencia.
4. Blindar el flujo de reclamo de fichas en `RewardsCore` y `PlayerChestsCore` con transferencia a sala con bono y retorno obligatorio a la sala base (o TIMEOUT_UNCERTAIN ante fallos).
5. Validar `npm run build`, `npx biome lint src/` y `npm test` al 100%.

## Tasks
- [x] Task 1: Crear `zDateHelper` y aplicarlo en schemas Zod (`player-chest`, `reward`, `room`) <!-- id: 1 -->
- [x] Task 2: Desacoplar `BonusIntern` en `LevelsEntity`, schemas y servicios de `src/levels` con `roomId` <!-- id: 2 -->
- [x] Task 3: Implementar en `PlayerRepoService` recálculo de nivel y migración de sala al acumular experiencia <!-- id: 3 -->
- [x] Task 4: Blindar el flujo de reclamo con retorno a sala base y control estricto de `TIMEOUT_UNCERTAIN` en `RewardsCore` y `PlayerChestsCore` <!-- id: 4 -->
- [x] Task 5: Actualizar pruebas unitarias y verificar suite completa, compilacion y linter <!-- id: 5 -->
