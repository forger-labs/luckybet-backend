# Plan de Corrección: Sincronización Automática de Sala, Tipos de Jugador y Limpieza de Build/Lint

Este documento detalla el plan paso a paso para resolver los errores de compilación (`nest build`), corregir las advertencias del linter (`biome lint`), implementar la obtención de la sala del jugador desde LuckyBet y el auto-registro de salas desconocidas con bono 0.

---

## 1. Detección y Creación Automática de Sala en LuckyBet (`PanelApiCore` y `Rooms`)
1. **Método `getPlayerSenior(userId)` en `AdminPanelService`**:
   - Consulta `GET /index.php?act=admin&area=useredit&id={userId}&response=js`.
   - Extrae el campo `fields.create_login.value` (ej: `"Superala"`).
2. **Sincronización en `PanelApiCore.syncOrRegisterPlayer`**:
   - Inyectar `ForDatabaseRooms` (o `BonusRoomRepoService`).
   - Al detectar un nuevo jugador:
     1. Llama a `adminPanel.getPlayerSenior(luckyBetId)`.
     2. Si devuelve un nombre de sala (ej. `"Superala"`):
        - Busca en la base de datos local: `roomRepo.findByName(seniorName)`.
        - **Si no existe la sala**: la crea automáticamente con `roomRepo.createRoom({ name: seniorName, bonus: BonusIntern.Zero, isActive: true })`.
        - Asigna ese `roomId` al crear el jugador (`playerRepo.createPlayer({ ..., roomId: room.id })`).

---

## 2. Corrección de Tipos de Jugador (`src/players`)
1. **`src/players/app/dto/player.schema.ts`**:
   - Ajustar `PlayerResponse` y `PlayerCreateResponse` para admitir `roomId?: number | null` y `room?: { id: number; name: string; bonus: string; isActive: boolean } | null`.
2. **`src/players/adapters/driven/PlayerRepo.service.ts`**:
   - En `createPlayer`, `updatePlayerById`, `getPlayers` y `findByUnique`:
     - Incluir `roomId` y la relación `room: true` en las consultas TypeORM.
     - Mapear `roomId: result.roomId ?? null` y el objeto `room: result.room ? { ... } : null`.

---

## 3. Corrección de DTOs y Errores de Misiones y Cofres (`src/misiones` y `src/chests`)
1. **`src/misiones/app/dto/update-mission.dto.ts`**:
   - Reemplazar la validación rota `bonus` por `roomId: z.coerce.number().int().optional().nullable()`.
2. **`src/misiones/app/dto/mission.schema.ts`**:
   - Asegurar que `MissionBasic` y `createMissionMultipartSchema` manejen `roomId?: number | null`.
3. **`src/chests/app/chestsCore.ts`**:
   - Asegurar que `dto.roomId` se asigne limpiamente en `createChest`.

---

## 4. Corrección de Linter (`biome lint`)
1. **`src/rewards/app/rewardsCore.ts`**:
   - Eliminar `async` innecesario en métodos síncronos o agregar `await`.
   - Usar optional chaining `targetRoom?.isActive`.
2. **`src/playerChests/app/playerChestsCore.ts`**:
   - Usar optional chaining `targetRoom?.isActive`.

---

## 5. Validación
- Ejecutar `npm run build` asegurando **0 errores**.
- Ejecutar `npx biome lint src/` asegurando **0 errores**.
- Ejecutar `npm test` verificando que las 26 suites sigan al 100% en verde.
