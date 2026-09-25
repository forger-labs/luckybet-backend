# Plan de Refactorización: Schemas de Fechas en Zod, Transición de Nivel y Sala por Nivel

Este documento establece el plan para corregir la serialización de fechas en Swagger/Zod y migrar la entidad `LevelsEntity` para desacoplar `BonusIntern` y vincular una sala con bono (`roomId`), actualizando la sala del jugador al subir de nivel.

---

## 1. Problema de Fechas en Schemas de Zod (`z.date()`)
- **Problema**: `z.date()` falla al interactuar con Fastify / Swagger / serialización JSON porque los payloads REST devuelven cadenas ISO (`string`) o timestamps, provocando fallos en validaciones de salida o Swagger metadata.
- **Solución Estándar**:
  - Reemplazar `z.date()` por un helper preprocesado reusable:
    ```typescript
    export const zDateString = z.preprocess((val) => {
      if (val instanceof Date) return val;
      if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
      }
      return val;
    }, z.date());
    ```
  - O en esquemas de respuesta OpenAPI: `z.string().datetime().or(z.date())`.
- **Archivos a modificar**:
  - `src/playerChests/app/dto/player-chest.schema.ts` (`claimedAt`).
  - `src/rewards/app/dto/reward.schema.ts` (`claimedAt`).
  - `src/rooms/app/dto/room.schema.ts` (`createdAt`, `updatedAt`).

---

## 2. Desacoplamiento de `BonusIntern` en Niveles (`src/levels`)
- **Problema actual**: La entidad `LevelsEntity` contiene `bonus: BonusIntern`. Al haber desacoplado los bonos en salas (`BonusRoom`), el nivel debe poder asociar una sala con bono (`room_id`) para que los beneficios de nivel correspondan a una sala real en LuckyBet.
- **Acciones**:
  1. **`LevelsEntity` (`src/levels/app/entities/levels.entity.ts`)**:
     - Eliminar la columna `bonus: BonusIntern`.
     - Agregar columna `room_id` (`int, nullable: true`) con relación `@ManyToOne(() => BonusRoom, { nullable: true, onDelete: 'SET NULL' })`.
  2. **DTOs y Schemas (`src/levels/app/dto/level.schema.ts`)**:
     - En `levelSchema`, `createLevelMultipartSchema`, `updateLevelMultipartSchema`, `levelFilterSchema`:
       - Reemplazar `bonus: z.enum(BonusIntern)` por `roomId?: number | null`.
     - Actualizar tipos `LevelType`, `CreateLevelMultipart`, `UpdateLevelMultipart`.
  3. **Repositorio y Core (`LevelsEntityService` y `LevelsCore`)**:
     - Mapear `roomId` en creación, actualización y consultas.
     - Ajustar controladores `LevelsController` y DTOs de Swagger.

---

## 3. Lógica de Subida de Nivel y Actualización de Sala (`PlayerRepoService`)
- **Regla de Negocio**:
  - Cuando un jugador suma experiencia (`experience`), el sistema debe recalcular su nivel consultando `levels`:
    - Encuentra el nivel más alto donde `player.experience >= level.minExperience`.
    - Si el jugador alcanza un nuevo nivel (`newLevelId !== player.levelId`):
      - Actualiza `player.levelId = newLevel.id`.
      - **Si el nuevo nivel tiene una sala asignada (`newLevel.roomId`)**:
        - Actualiza la sala del jugador: `player.roomId = newLevel.roomId`.
        - Transfiere al jugador en LuckyBet a la nueva sala:
          `panelApi.changePlayerSenior(player.username, newRoom.name)`.
- **Dónde implementarlo**:
  - En un método helper unificado `recalculatePlayerLevel(playerId: number)` en `PlayerRepoService` (o invocado desde `MisionesCore` y `PlayerChestsCore` al sumar experiencia).

---

## 4. Checklist de Ejecución
1. [ ] Crear helper `zDate` / migrar `claimedAt`, `createdAt`, `updatedAt` en los DTOs de `playerChests`, `rewards` y `rooms`.
2. [ ] Migrar `LevelsEntity` y DTOs de `src/levels` (`bonus` -> `roomId`).
3. [ ] Actualizar `LevelsEntityService`, `LevelsCore` y `LevelsController`.
4. [ ] Implementar la actualización de nivel y sala del jugador al acumular experiencia.
5. [ ] Ejecutar `npm run build` y `npx biome lint src/`.
6. [ ] Ejecutar `npm test` verificando que todas las suites pasen al 100% en verde.
