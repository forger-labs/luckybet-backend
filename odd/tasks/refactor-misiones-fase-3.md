# ODD: Módulos de Cofres (Chests y PlayerChests) (Fase 3)

Este documento registra el seguimiento del plan de trabajo para la Fase 3: Desacoplamiento de la configuración de cofres (`src/chests`) y el progreso/reclamo del jugador (`src/playerChests`).

## Tasks
- [x] Task 1: Crear Módulo `src/chests` (Entidad `MissionChest`, DTOs, Repo, Core, Controller Admin y Módulo) <!-- id: 1 -->
- [x] Task 2: Crear Módulo `src/playerChests` (Entidad `UserMissionChest`, Repo con bloqueo atómico, DTOs) <!-- id: 2 -->
- [x] Task 3: Implementar cálculo de progreso on-demand y reclamo seguro en `PlayerChestsCore` <!-- id: 3 -->
- [x] Task 4: Exponer endpoints en `PlayerChestsController` y registrar ambos módulos en `AppModule` <!-- id: 4 -->
- [x] Task 5: Crear pruebas unitarias para `chestsCore` y `playerChestsCore` y validar la suite completa <!-- id: 5 -->
