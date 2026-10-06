import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { buildResponse } from '../../../shared/libs/buildResponse';
import { STATISTICS_CORE_PROVIDER } from '../../app/constants';
import {
	LeaderboardApiResponseDto,
	LeaderboardFilterDto,
	LeaderboardPeriod,
} from '../../app/dto/statistics-leaderboard.schema';
import type { ForManageStatistics } from '../../ports/driven/forManageStatistics';

@ApiTags('Statistics (Public)')
@Controller('statistics')
export class StatisticsPublicController {
	constructor(
		@Inject(STATISTICS_CORE_PROVIDER)
		private readonly statisticsCore: ForManageStatistics,
	) {}

	@Get('leaderboard')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: LeaderboardApiResponseDto })
	@ApiQuery({
		name: 'period',
		required: false,
		enum: LeaderboardPeriod,
		description: 'Periodo del ranking: WEEKLY, MONTHLY o ALL_TIME',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Cantidad máxima de jugadores (máx: 100, default: 20)',
	})
	async getLeaderboard(@Query() filter: LeaderboardFilterDto) {
		const result = await this.statisticsCore.getLeaderboard(filter);
		return buildResponse(result, 'Ranking de jugadores obtenido exitosamente', true);
	}
}
