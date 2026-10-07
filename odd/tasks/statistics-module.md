# Feature: Statistics Module

## Overview
Implement the Statistics module for LuckyBet backend under `src/statistics/` using Hexagonal Architecture, strict TypeScript typing (no `any`), and native SQL aggregate queries over composite indexes in PostgreSQL.

## Tasks
- [x] 1. Define DTOs and Zod schemas for Statistics (summary, liabilities, risk, SLA, engagement, leaderboard)
- [ ] 2. Define Hexagonal Ports (`ForDatabaseStatistics` and `ForManageStatistics`)
- [ ] 3. Implement `StatisticsRepoService` with native SQL aggregations (SUM, COUNT, AVG) over TypeORM
- [ ] 4. Implement `StatisticsCore` with business logic and ratios
- [ ] 5. Implement `StatisticsController` and `StatisticsPublicController`
- [ ] 6. Register `StatisticsModule` in `AppModule` and configure indexes
- [ ] 7. Create unit tests and verify build / lint
