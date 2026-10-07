# ODD: Módulo de Salas (Rooms), Asignación de Sala a Player y Desacoplamiento de Bonos

Este documento registra el seguimiento del plan de trabajo para crear el módulo `src/rooms`, asociar la sala default en `Player`, soportar `changePlayerSenior` en `PanelApi` y reemplazar `BonusIntern` por `roomId` en Misiones, Chests y Rewards.

## Tasks
- [x] Task 1: Crear Módulo `src/rooms` (Entidad `BonusRoom`, DTOs con filtros, Repo, Core, Controller Admin y Módulo) <!-- id: 1 -->
- [x] Task 2: Actualizar `Player` y `PlayerRepoService` con `roomId` (relación a `BonusRoom`) <!-- id: 2 -->
- [x] Task 3: Implementar `changePlayerSenior` en `AdminPanelService` y `PanelApiCore` <!-- id: 3 -->
- [x] Task 4: Refactorizar `Misiones` y `Chests` reemplazando `bonus` por `roomId` <!-- id: 4 -->
- [x] Task 5: Refactorizar `Rewards` y `PlayerChests` con `roomId` y transferencia de sala antes de `creditPlayer` <!-- id: 5 -->
- [x] Task 6: Crear pruebas unitarias y verificar suite completa al 100% <!-- id: 6 -->
