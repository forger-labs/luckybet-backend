# Plan de Refactorización Integral: Módulo `src/players`

Este documento establece la arquitectura y el plan de refactorización para sanear las responsabilidades en el módulo `src/players`, de acuerdo con Clean Architecture, separación de capas e invariantes de `@RULES.md`.

---

## 1. Problemas Identificados y Objetivos

### 1.1 Inyección indebida de `StorageService` en `PlayerRepoService` (Driven Adapter)
- **Problema**: `PlayerRepoService` inyecta `StorageService` para transformar las keys de imágenes (`level.image`) en URLs públicas completas dentro del método privado `toPublicUrl`. Un repositorio (adaptador secundario) solo debe encargarse de persistencia y mapeo de datos planos, sin conocer detalles de infraestructura de almacenamiento cloud.
- **Solución**: Mover la inyección de `StorageService` a `PlayersCore`. El repositorio devuelve la entidad con la key relativa almacenada en la base de datos (o null), y es `PlayersCore` quien invoca `storage.buildPublicUrl(key)` antes de retornar los DTOs al controlador o a otros consumidores.

### 1.2 Uso de `findOne` + `save` para editar en `updatePlayerById`
- **Problema**: En `PlayerRepoService.updatePlayerById` se hace un `findOne` previo y luego un `save(player)`, lo cual ejecuta queries innecesarias y no utiliza el método optimizado de TypeORM `update`.
- **Solución**: Refactorizar para usar `await this.playerModel.update(id, updateData)` directamente, seguido de la consulta del registro actualizado solo si la mutación afectó filas.

### 1.3 Sobrecarga de responsabilidades en `PlayerRepoService.addExperienceAndRecalculateLevel`
- **Problema**: `PlayerRepoService` actualmente inyecta `LevelsCore` (para calcular si subió de nivel) y `LevelRewardRepoService` (para emitir la recompensa del nuevo nivel), coordinando múltiples repositorios y cores dentro de un adaptador driven. Un repositorio no debe orquestar lógica de negocio ni comunicarse con múltiples servicios.
- **Solución**:
  - `PlayerRepoService` únicamente expondrá primitivas de persistencia: `incrementExperience(playerId, expPoints): Promise<number>` y `updateLevel(playerId, levelId): Promise<void>`.
  - La orquestación de evaluar el nuevo nivel y generar la recompensa en `LevelRewardRepo` se traslada a `PlayersCore.addExperience(playerId, expPoints)`.
  - Los consumidores de recompensas (`MisionesCore`, `PlayerChestsCore`) interactuarán con `ForManagePlayers` (`PlayersCore`) y no con el repositorio para recálculos de nivel.

### 1.4 Filtros avanzados y ordenamiento temporal (`ASC` / `DESC`) para consulta de jugadores (`GET /api/v1.0/players`)
- **Problema**: Actualmente `GET /players` solo acepta `take` y `skip` con orden fijo.
- **Solución**:
  - Crear `PlayerQueryFilterDto` y schema Zod con soporte para:
    - `username` *(string, opcional, búsqueda parcial ILike)*
    - `phone` *(string, opcional, búsqueda parcial ILike)*
    - `levelId` *(number, opcional, filtro exacto por nivel)*
    - `minExperience` *(number, opcional, filtro `>=`)*
    - `maxExperience` *(number, opcional, filtro `<=`)*
    - `roomId` *(number, opcional, filtro por sala)*
    - `isActive` *(utilizando `zBooleanQuery` de `src/shared/swagger/boolean.schema.ts` para aceptar 'true'/'false'/boolean)*
    - `orderDirection` *(enum: `ASC` | `DESC`, default: `DESC`, para ordenar por fecha de creación `created_at`)*
    - `take` *(number, default 50)*
    - `skip` *(number, default 0)*
  - Actualizar `PlayerRepoService.getPlayers` para construir el `FindOptionsWhere` dinámico con TypeORM (`ILike`, `Between`, `MoreThanOrEqual`, `LessThanOrEqual`) y aplicar el `order: { created_at: orderDirection }`.

---

## 2. Matriz de Cambios por Archivo

| Archivo | Tipo de Cambio | Responsabilidad |
| :--- | :--- | :--- |
| `src/players/app/dto/player.schema.ts` | Modificación | Agregar `playerFilterSchema`, DTOs de filtrado con `zBooleanQuery` y ordenamiento `orderDirection: ASC/DESC`. |
| `src/players/adapters/driven/PlayerRepo.service.ts` | Refactor | 1) Retirar `StorageService`, `LevelsCore`, `LevelRewardRepo`. 2) Reemplazar `save` por `this.playerModel.update` en `updatePlayerById`. 3) Implementar filtros dinámicos y ordenamiento `created_at: ASC/DESC` en `getPlayers`. 4) Mantener solo operaciones de base de datos de jugadores. |
| `src/players/ports/driver/ForDatabasePlayers.ts` | Modificación | Ajustar contrato de repositorio eliminando dependencias de lógica de nivel y aceptando filtros. |
| `src/players/app/playersCore.ts` | Refactor | 1) Inyectar `StorageService`, `LevelsCore` y `LevelRewardRepo`. 2) Orquestar `addExperienceAndRecalculateLevel`. 3) Enriquecer URLs públicas con `storage.buildPublicUrl`. 4) Manejar listado filtrado con ordenamiento temporal. |
| `src/players/ports/driven/ForManagePlayers.ts` | Modificación | Exponer `addExperienceAndRecalculateLevel` y `getPlayers` filtrado en el puerto de dominio. |
| `src/players/adapters/driver/players.controller.ts` | Modificación | Conectar `findAll` con `@Query() filter: PlayerFilterDto`. Documentar en Swagger. |
| `src/players/players.module.ts` | Modificación | Reorganizar providers y exports acordes a las nuevas inyecciones de `PlayersCore`. |
| `src/misiones/` y `src/playerChests/` | Modificación | Actualizar llamadas de experiencia hacia `PlayersCore` (`ForManagePlayers`). |
| `src/players/adapters/driven/PlayerRepo.service.spec.ts` y `playersCore.spec.ts` | Actualización | Adaptar tests unitarios a los nuevos contratos y mocks. |
| `docs/endpoints-api-reference.md` | Actualización | Documentar los nuevos query params y ordenamiento de `GET /players`. |

---

## 3. Plan de Tareas Paso a Paso (Task Checklist)

- [ ] **Paso 1: Schemas y DTOs de Filtrado y Ordenamiento**:
  - Definir `playerFilterSchema` en `src/players/app/dto/player.schema.ts` integrando `zBooleanQuery` y `orderDirection: ASC | DESC`.
- [ ] **Paso 2: Puertos de Repositorio (`ForDatabasePlayers`)**:
  - Actualizar `getPlayers(filter: PlayerFilter)` y métodos de actualización atómica en `ForDatabasePlayers`.
- [ ] **Paso 3: Limpieza y Optimización de `PlayerRepoService`**:
  - Eliminar inyecciones de `StorageService`, `LevelsCore` y `LevelRewardRepo`.
  - Migrar `updatePlayerById` a `this.playerModel.update`.
  - Implementar filtros dinámicos (`ILike`, operadores numéricos) y ordenamiento `created_at` (`ASC` / `DESC`) en `getPlayers`.
- [ ] **Paso 4: Enriquecimiento y Lógica en `PlayersCore`**:
  - Inyectar `StorageService`, `LevelsCore` y `LevelRewardRepo` en `PlayersCore`.
  - Aplicar `buildPublicUrl` a `player.level.image`.
  - Mover la lógica de cálculo de nuevo nivel y emisión de `LevelReward` a `PlayersCore`.
- [ ] **Paso 5: Controlador y Swagger (`PlayersController`)**:
  - Inyectar `PlayerFilterDto` en `findAll` de `PlayersController`.
- [ ] **Paso 6: Ajuste de Consumidores (`MisionesCore` y `PlayerChestsCore`)**:
  - Redirigir el llamado de experiencia a `playersCore.addExperienceAndRecalculateLevel`.
- [ ] **Paso 7: Actualización de Módulos (`PlayersModule`, etc.)**:
  - Exportar e inyectar providers limpios en `PlayersModule`.
- [ ] **Paso 8: Tests Unitarios y Calidad (@RULES.md)**:
  - Actualizar tests de `PlayerRepoService` y `PlayersCore`.
  - Correr `pnpm exec biome lint src/`, `pnpm test`, `pnpm run build:clean`, `pnpm run build`.
- [ ] **Paso 9: Documentación en `docs/endpoints-api-reference.md`**:
  - Actualizar la referencia del endpoint `GET /api/v1.0/players` con los nuevos query params y ordenamiento.
