# Plan de Implementación: Módulo de Estadísticas y Cronjob de Expiración de Misiones en PostgreSQL

Este documento define la arquitectura, diseño de endpoints, estrategia de paginación por índice (Keyset / Seek Method), agregaciones desacopladas y el mecanismo de expiración automática de misiones en base de datos.

---

## 1. Principios de Diseño y Arquitectura

1. **Arquitectura Hexagonal Estricta**:
   - Todo el módulo vive en `src/statistics/` separado en `ports` (driver / driven), `adapters` (controllers y repo service) y `app` (core y DTOs).
2. **Desacoplamiento de Consultas (No Monolitos)**:
   - Endpoints granulares e independientes para evitar acumulación de latencia (*blast radius* cero entre métricas financieras, operativas y de engagement).
   - Permite cacheo granular en Redis con diferentes TTLs según la volatilidad del dato.
3. **Paginación por Índice / Keyset Pagination ($O(\log N)$)**:
   - Prohibido el uso de `OFFSET / LIMIT` en listados de recompensas masivas.
   - Se utiliza cursor determinista opaco (Base64) basado en tuplas indexadas `(claimed_at, id)` o `(created_at, id)`.
4. **Automatización en Base de Datos**:
   - Stored Procedure e índice de expiración en PostgreSQL con soporte para `pg_cron` (o fallback programado) para desactivar misiones que alcancen su fecha de vencimiento (`expires_at <= NOW()`).

---

## 2. Estrategia de Consultas y Rendimiento (Agregaciones Nativas sobre Índices Compuestos)

### 2.1. Agregaciones Nativas en el Motor SQL
Para todas las métricas consolidadas (`SUM`, `COUNT`, `AVG`):
- El cálculo se ejecuta **100% dentro del motor de PostgreSQL** en C, apoyado directamente en **índices B-Tree compuestos**.
- La base de datos no transfiere filas completas a Node.js; se envía **una sola tupla con los valores escalares calculados** (tiempo de red mínimo ~1-3ms, consumo de memoria en V8 despreciable, 1 solo round-trip sin saturar el pool de conexiones).

### 2.2. Índices Compuestos Estratégicos
Se definen/aseguran los siguientes índices compuestos en base de datos para optimizar los filtros por rango temporal y estado:
- `mission_rewards`: `(status, claimed_at, coins_amount)` y `(status, created_at, coins_amount)`
- `level_rewards`: `(status, claimed_at, coins_amount)` y `(status, created_at, coins_amount)`
- `user_mission_chests`: `(status, claimed_at, coins_amount)` y `(period_key, status)`
- `user_missions`: `(status, completed_at)` y `(status, started_at)`
- `user_mission_steps`: `(status, reviewed_at, created_at)`
- `missions`: `(status, expires_at)` (para la expiración inmediata en cron)

### 2.3. Criterio de Batching
El procesamiento por lotes (batching por índice / seek chunks) se reserva exclusivamente para procesos analíticos pesados de fondo o exportaciones masivas en el futuro, manteniendo los endpoints de consulta en tiempo real directos y atómicos.

---

## 3. Catálogo de Endpoints del Módulo `statistics`

### 3.1. 💰 Resumen Financiero y Volumen de Emisión (`Admin`)
- `GET /statistics/summary?startDate=...&endDate=...`
  - **Métricas calculadas:**
    - `totalCoins`: Total de fichas regaladas en estado `CLAIMED`.
    - `missionsCoins`: Fichas regaladas por misiones completadas.
    - `levelsCoins`: Fichas regaladas por ascensos de nivel.
    - `chestsCoins`: Fichas regaladas por cofres semanales/mensuales.
    - `completedMissionsCount`: Conteo de misiones completadas en el rango.
    - `levelUpsCount`: Conteo de subidas de nivel registradas en el rango.
    - `claimedChestsCount`: Conteo de reclamos de cofres en el rango.

### 3.2. ⏳ Pasivo Flotante y Economía de Reclamos (`Admin`)
- `GET /statistics/liabilities?startDate=...&endDate=...`
  - **Métricas calculadas:**
    - `pendingCoins`: Fichas en estado `PENDING` (pasivo pendiente por reclamar).
    - `claimedCoins`: Fichas en estado `CLAIMED`.
    - `claimRate`: Ratio de reclamo (`claimed / (claimed + pending)`).
    - `pendingClaimsCount`: Cantidad de premios sin reclamar por los usuarios.

### 3.3. 🚨 Salud Operativa y Monitoreo de Riesgo (`Admin`)
- `GET /statistics/operational/risk?startDate=...&endDate=...`
  - **Métricas calculadas:**
    - `uncertainClaimsCount`: Total de transacciones en estado `TIMEOUT_UNCERTAIN`.
    - `uncertainCoinsAmount`: Total de fichas retenidas en estado incierto.
    - `breakdown`: Conteo y volumen de fichas discriminadas por fuente (misión, nivel, cofre).

### 3.4. ⏱️ Rendimiento Operativo de Moderación / SLA (`Admin`)
- `GET /statistics/operational/reviewers-sla?startDate=...&endDate=...`
  - **Métricas calculadas:**
    - `averageReviewTimeMinutes`: Tiempo promedio de resolución de steps (`AVG(reviewed_at - created_at)`).
    - `reviewedStepsCount`: Total de steps manuales evaluados en el rango.
    - `reviewsByAdmin`: Desglose de aprobaciones/rechazos por `adminId`.

### 3.5. 📜 Feeds Transaccionales con Keyset Cursor (`Admin`)
- `GET /statistics/rewards/missions?cursor=...&limit=50&startDate=...&endDate=...&status=...&playerId=...`
- `GET /statistics/rewards/levels?cursor=...&limit=50&startDate=...&endDate=...&status=...&playerId=...`
- `GET /statistics/rewards/chests?cursor=...&limit=50&startDate=...&endDate=...&status=...&playerId=...`
  - Paginación pura por índice con cursor codificado.

### 3.6. 🎮 Gamificación y Engagement (`Admin`)
- `GET /statistics/missions/engagement?startDate=...&endDate=...`
  - `completionRate`: Misiones finalizadas vs iniciadas.
  - `abandonedMissionsCount`: Misiones que quedaron `IN_PROGRESS` sin actividad.
  - `averageCompletionTimeMinutes`: `AVG(completed_at - started_at)`.
- `GET /statistics/levels/distribution`
  - Pirámide de niveles: Conteo y porcentaje de jugadores activos por cada `level_id`.
- `GET /statistics/chests/summary?periodKey=...`
  - Participación y tasa de reclamo por cofre en el período.

### 3.7. 🏆 Leaderboard de Recompensas (`Público / Jugadores` + `Admin`)
- `GET /statistics/leaderboard?period=weekly|monthly|all_time&limit=20&cursor=...`
  - Ranking de jugadores con más fichas reclamadas en el período.

---

## 4. Cronjob de Expiración de Misiones (NestJS Schedule + TypeORM)

### 4.1. Lógica de Desactivación Automática
Una misión pasa automáticamente a `INACTIVE` cuando:
1. Su estado actual es `ACTIVE`.
2. Su fecha de expiración `expires_at` está definida y `expires_at <= NOW()`.

Al desactivarse una misión expirada, las participaciones de jugadores (`user_missions`) que quedaron en estado `IN_PROGRESS` se actualizan a `EXPIRED`.

### 4.2. Implementación con TypeORM y `@nestjs/schedule`
```typescript
@Injectable()
export class MissionExpiryCronService {
  private readonly logger = new Logger(MissionExpiryCronService.name);

  constructor(
    @InjectRepository(Mission)
    private readonly missionRepo: Repository<Mission>,
    @InjectRepository(UserMission)
    private readonly userMissionRepo: Repository<UserMission>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredMissions(): Promise<void> {
    const now = new Date();

    const missionResult = await this.missionRepo
      .createQueryBuilder()
      .update(Mission)
      .set({ status: MissionStatus.INACTIVE })
      .where('status = :status', { status: MissionStatus.ACTIVE })
      .andWhere('expires_at IS NOT NULL AND expires_at <= :now', { now })
      .execute();

    if (missionResult.affected && missionResult.affected > 0) {
      this.logger.log(`[Cron] Se desactivaron ${missionResult.affected} misiones expiradas.`);

      await this.userMissionRepo
        .createQueryBuilder()
        .update(UserMission)
        .set({ status: UserMissionStatus.EXPIRED })
        .where('status = :status', { status: UserMissionStatus.IN_PROGRESS })
        .andWhere(
          'mission_id IN (SELECT id FROM missions WHERE status = :inactive AND expires_at <= :now)',
          { inactive: MissionStatus.INACTIVE, now },
        )
        .execute();
    }
  }
}
```

### 4.3. Índice Condicional de Soporte en PostgreSQL
```sql
CREATE INDEX IF NOT EXISTS "IDX_missions_active_expires_at"
ON missions (status, expires_at)
WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;
```

---

## 5. Estructura de Módulos y Archivos a Crear

```text
src/statistics/
├── adapters/
│   ├── driver/
│   │   ├── statistics.controller.ts            # Rutas protegidas para administradores
│   │   └── statistics-public.controller.ts     # Rutas públicas (Leaderboard)
│   └── driven/
│       └── statisticsRepo.service.ts           # Repositorio TypeORM con QueryBuilder indexado
├── app/
│   ├── dto/
│   │   ├── cursor-pagination.dto.ts            # Helper y DTOs genéricos de Keyset Cursor
│   │   ├── statistics-summary.dto.ts           # DTOs de resumen financiero y eventos
│   │   ├── statistics-liabilities.dto.ts       # DTOs de pasivo y tasa de reclamo
│   │   ├── statistics-operational.dto.ts       # DTOs de riesgo y SLA de reviewers
│   │   ├── statistics-rewards.dto.ts           # DTOs de feeds transaccionales de rewards
│   │   ├── statistics-engagement.dto.ts        # DTOs de métricas de misiones y niveles
│   │   └── statistics-leaderboard.dto.ts       # DTOs de ranking de jugadores
│   ├── constants.ts                            # Tokens de inyección de dependencias
│   └── statisticsCore.ts                       # Caso de uso y lógica de agregación
├── ports/
│   ├── driver/
│   │   └── forDatabaseStatistics.ts            # Interfaz de persistencia
│   └── driven/
│       └── forManageStatistics.ts              # Interfaz de servicio de aplicación
├── __tests__/
│   ├── statisticsCore.spec.ts
│   └── statisticsRepo.service.spec.ts
└── statistics.module.ts
```

---

## 6. Checklist de Ejecución

1. [ ] **Paginación por Índice**:
   - Crear `src/statistics/app/dto/cursor-pagination.dto.ts` y función auxiliar `buildCursorPaginatedResponse` en `src/shared/libs/buildResponse.ts`.
2. [ ] **Contratos y DTOs**:
   - Crear schemas Zod para todos los endpoints desacoplados en `src/statistics/app/dto/`.
   - Definir puertos `ForDatabaseStatistics` y `ForManageStatistics`.
3. [ ] **Capa de Persistencia (`StatisticsRepoService`)**:
   - Implementar queries optimizadas con `QueryBuilder` y B-Tree seek para feeds transaccionales.
   - Implementar agregaciones SQL agrupadas para `summary`, `liabilities`, `operational`, `engagement` y `leaderboard`.
4. [ ] **Capa de Dominio (`StatisticsCore`)**:
   - Orquestar cálculos de ratios, tiempos promedio y agregaciones.
5. [ ] **Capa de Controladores (`StatisticsController` & `StatisticsPublicController`)**:
   - Configurar rutas, DTOs de Swagger y Guards de autenticación (`JwtGuard`, `RolesGuard`).
6. [ ] **Cronjob de Expiración en PostgreSQL**:
   - Crear script/migración SQL con la función `fn_deactivate_expired_missions()` y programación `pg_cron` (más índice condicional).
7. [ ] **Integración en `AppModule`**:
   - Registrar `StatisticsModule` en `src/app.module.ts`.
8. [ ] **Testing y Verificación**:
   - Pruebas unitarias en `statisticsCore.spec.ts` y `statisticsRepo.service.spec.ts`.
   - Validación de build (`pnpm build`), linter (`npx biome check .`) y tests (`pnpm test`).
