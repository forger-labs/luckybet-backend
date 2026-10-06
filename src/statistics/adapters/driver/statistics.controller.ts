import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtGuard } from '../../../auth/app/guards/jwt.guard';
import { RolesGuard } from '../../../auth/app/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { buildResponse } from '../../../shared/libs/buildResponse';
import { AdminRoles } from '../../../users/app/entities/user.entity';
import { STATISTICS_CORE_PROVIDER } from '../../app/constants';
import {
	ChestSummaryFilterDto,
	ChestsSummaryResponseDto,
	LevelsDistributionResponseDto,
	MissionsEngagementResponseDto,
} from '../../app/dto/statistics-engagement.schema';
import { DateRangeFilterDto } from '../../app/dto/statistics-filter.schema';
import { StatisticsLiabilitiesResponseDto } from '../../app/dto/statistics-liabilities.schema';
import {
	OperationalRiskResponseDto,
	ReviewersSlaResponseDto,
} from '../../app/dto/statistics-operational.schema';
import { StatisticsSummaryResponseDto } from '../../app/dto/statistics-summary.schema';
import type { ForManageStatistics } from '../../ports/driven/forManageStatistics';

@ApiTags('Statistics (Admin)')
@Controller('statistics')
@UseGuards(JwtGuard, RolesGuard)
@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
@ApiCookieAuth()
export class StatisticsController {
	constructor(
		@Inject(STATISTICS_CORE_PROVIDER)
		private readonly statisticsCore: ForManageStatistics,
	) {}

	@Get('summary')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StatisticsSummaryResponseDto })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Fecha inicial ISO 8601',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'Fecha final ISO 8601',
	})
	async getSummary(@Query() filter: DateRangeFilterDto) {
		const summary = await this.statisticsCore.getSummary(filter);
		return buildResponse(summary, 'Resumen de estadísticas obtenido exitosamente', true);
	}

	@Get('liabilities')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StatisticsLiabilitiesResponseDto })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Fecha inicial ISO 8601',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'Fecha final ISO 8601',
	})
	async getLiabilities(@Query() filter: DateRangeFilterDto) {
		const liabilities = await this.statisticsCore.getLiabilities(filter);
		return buildResponse(liabilities, 'Reporte de pasivos obtenido exitosamente', true);
	}

	@Get('operational/risk')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: OperationalRiskResponseDto })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Fecha inicial ISO 8601',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'Fecha final ISO 8601',
	})
	async getOperationalRisk(@Query() filter: DateRangeFilterDto) {
		const risk = await this.statisticsCore.getOperationalRisk(filter);
		return buildResponse(risk, 'Reporte de riesgo operativo obtenido exitosamente', true);
	}

	@Get('operational/reviewers-sla')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ReviewersSlaResponseDto })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Fecha inicial ISO 8601',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'Fecha final ISO 8601',
	})
	async getReviewersSla(@Query() filter: DateRangeFilterDto) {
		const sla = await this.statisticsCore.getReviewersSla(filter);
		return buildResponse(sla, 'Reporte de SLA de revisores obtenido exitosamente', true);
	}

	@Get('missions/engagement')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionsEngagementResponseDto })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Fecha inicial ISO 8601',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'Fecha final ISO 8601',
	})
	async getMissionsEngagement(@Query() filter: DateRangeFilterDto) {
		const engagement = await this.statisticsCore.getMissionsEngagement(filter);
		return buildResponse(
			engagement,
			'Métricas de engagement de misiones obtenidas exitosamente',
			true,
		);
	}

	@Get('levels/distribution')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: LevelsDistributionResponseDto })
	async getLevelsDistribution() {
		const distribution = await this.statisticsCore.getLevelsDistribution();
		return buildResponse(
			distribution,
			'Distribución de jugadores por nivel obtenida exitosamente',
			true,
		);
	}

	@Get('chests/summary')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestsSummaryResponseDto })
	@ApiQuery({
		name: 'periodKey',
		required: false,
		type: String,
		description: 'Clave de periodo (ej: 2026-W10)',
	})
	async getChestsSummary(@Query() filter: ChestSummaryFilterDto) {
		const summary = await this.statisticsCore.getChestsSummary(filter);
		return buildResponse(
			summary,
			'Resumen de progreso de cofres obtenido exitosamente',
			true,
		);
	}
}
