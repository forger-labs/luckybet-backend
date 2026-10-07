# Tareas: Refactorización Integral del Módulo Players

- [ ] Task 1: Schemas y DTOs de Filtrado y Ordenamiento (`playerFilterSchema`, `orderDirection: ASC | DESC`, `zBooleanQuery`).
- [ ] Task 2: Actualizar interfaces de puertos (`ForDatabasePlayers` y `ForManagePlayers`).
- [ ] Task 3: Refactorizar `PlayerRepoService`: remover `StorageService`, usar `playerModel.update`, filtros dinámicos y ordenamiento por `created_at`.
- [ ] Task 4: Refactorizar `PlayersCore`: inyectar `StorageService`, orquestar experiencia y cálculo de nivel, enriquecer URLs públicas.
- [ ] Task 5: Actualizar `PlayersController` para recibir `PlayerFilterDto` en `GET /players`.
- [ ] Task 6: Actualizar consumidores de experiencia (`MisionesCore`, `PlayerChestsCore`) para usar `ForManagePlayers`.
- [ ] Task 7: Actualizar configuración e inyecciones en `PlayersModule`, `MisionesModule` y `PlayerChestsModule`.
- [ ] Task 8: Actualizar y ejecutar tests unitarios de `PlayerRepoService` y `PlayersCore`.
- [ ] Task 9: Verificación de calidad completa según `@RULES.md` (`biome lint`, `test`, `build:clean`, `build`).
- [ ] Task 10: Actualizar `docs/endpoints-api-reference.md` con los nuevos query params y ejemplos JSON.
