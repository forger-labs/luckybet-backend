# ODD: Refactorizar Misiones, Seguridad y Pasos Automáticos (Fase 1)

Este documento registra el seguimiento del plan de trabajo para la Fase 1 del módulo de misiones.

## Tasks
- [x] Task 1: Refactorizar Enums, Entidad `MissionStep` y DTOs con `GAME_PLAY` y `targetConfig` <!-- id: 1 -->
- [x] Task 2: Actualizar `UserMissionRepo` e interfaces para soportar verificación de ownership y pasos automáticos <!-- id: 2 -->
- [x] Task 3: Implementar `verifyAutoStep` y validación de ownership en `MisionesCore` <!-- id: 3 -->
- [x] Task 4: Refactorizar `PlayerMisionesController` con `PlayerTokenGuard`, `@CurrentPlayer()`, `@CurrentToken()` y saneamiento de rutas <!-- id: 4 -->
- [x] Task 5: Actualizar `MissionsController` con `JwtGuard`, `RolesGuard` y `@CurrentUser()` en la revisión de pasos <!-- id: 5 -->
- [x] Task 6: Actualizar pruebas unitarias y e2e existentes y verificar cobertura <!-- id: 6 -->
