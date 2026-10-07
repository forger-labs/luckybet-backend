# ODD: Módulo de Recompensas y Reclamo Seguro (Fase 2)

Este documento registra el seguimiento del plan de trabajo para la Fase 2 del módulo de recompensas desacoplado.

## Tasks
- [x] Task 1: Crear Enum RewardStatus, Entidad `MissionReward` y DTOs en `src/rewards` <!-- id: 1 -->
- [x] Task 2: Crear Puerto y Servicio de Repositorio `MissionRewardRepo` en `src/rewards` <!-- id: 2 -->
- [x] Task 3: Integrar generación de `MissionReward` y acreditación inmediata de experiencia en `MisionesCore` <!-- id: 3 -->
- [x] Task 4: Implementar `RewardsCore` con `claimReward`, `getPendingRewards` y `resolveUncertainReward` <!-- id: 4 -->
- [x] Task 5: Exponer endpoints de reclamo y resolución en `RewardsController` y registrar `RewardsModule` <!-- id: 5 -->
- [x] Task 6: Crear pruebas unitarias para `RewardsCore` y verificar que la suite completa pase al 100% <!-- id: 6 -->
