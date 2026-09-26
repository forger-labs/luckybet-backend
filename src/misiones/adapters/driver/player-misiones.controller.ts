import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	ParseIntPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiCreatedResponse,
	ApiHeader,
	ApiOkResponse,
	ApiQuery,
} from '@nestjs/swagger';

import {
	CurrentPlayer,
	CurrentToken,
} from '../../../panelApi/app/decorators/currentPlayer.decorator';
import { PlayerTokenGuard } from '../../../panelApi/app/guards/playerToken.guard';
import type { PlayerAuthContext } from '../../../panelApi/types/panelApiCore.types';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { SubmitStepMultipartDto } from '../../app/dto/create-mission.dto';
import {
	StepResponseDto,
	UserMissionFilterDto,
	UserMissionResponseDto,
} from '../../app/dto/mission.schema';
import type { ForManagePlayerMissions } from '../../ports/driven/ForManagePlayerMissions';

@Controller('missions')
@UseGuards(PlayerTokenGuard)
@ApiHeader({
	name: 'Authorization',
	description: 'Bearer {playerToken} o x-player-token header',
	required: true,
})
export class PlayerMisionesController {
	constructor(
		@Inject(MISIONES_CORE_PROVIDER)
		private readonly misionesCore: ForManagePlayerMissions,
	) {}

	@Post(':missionId/start')
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: UserMissionResponseDto })
	async startMission(
		@Param('missionId', ParseIntPipe) missionId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const result = await this.misionesCore.startMission(player.id, missionId);
		return buildResponse(result, 'Mision iniciada exitosamente', true);
	}

	@Post('user-missions/:userMissionId/steps/:stepId/submit')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StepResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				submissionText: { type: 'string' },
				submissionImage: { type: 'string', format: 'binary' },
			},
		},
	})
	async submitStep(
		@Param('userMissionId', ParseIntPipe) userMissionId: number,
		@Param('stepId', ParseIntPipe) stepId: number,
		@Body() dto: SubmitStepMultipartDto,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const result = await this.misionesCore.submitStep(
			userMissionId,
			stepId,
			dto,
			player.id,
		);
		return buildResponse(result, 'Paso enviado exitosamente', true);
	}

	@Post('user-missions/:userMissionId/steps/:stepId/verify')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StepResponseDto })
	async verifyAutoStep(
		@Param('userMissionId', ParseIntPipe) userMissionId: number,
		@Param('stepId', ParseIntPipe) stepId: number,
		@CurrentPlayer() player: PlayerAuthContext,
		@CurrentToken() token: string | null,
	) {
		const result = await this.misionesCore.verifyAutoStep(
			userMissionId,
			stepId,
			player.id,
			token ?? undefined,
		);
		return buildResponse(result, 'Paso automatico verificado exitosamente', true);
	}

	@Get('my-missions')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: UserMissionResponseDto })
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
	})
	@ApiQuery({ name: 'missionId', required: false, type: Number })
	@ApiQuery({
		name: 'orderDirection',
		required: false,
		enum: ['ASC', 'DESC'],
		description: 'Orden por fecha de creación (ASC o DESC)',
	})
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async getPlayerMissions(
		@CurrentPlayer() player: PlayerAuthContext,
		@Query() filter: UserMissionFilterDto,
	) {
		const response = await this.misionesCore.getPlayerMissions(player.id, filter);
		return buildPaginatedResponse(
			response.missions,
			'Misiones obtenidas exitosamente',
			true,
			{
				limit: response.limit,
				skip: response.skip,
				total: response.total,
			},
		);
	}

	@Get('user-missions/:userMissionId')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: UserMissionResponseDto })
	async getPlayerMission(
		@Param('userMissionId', ParseIntPipe) userMissionId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const result = await this.misionesCore.getPlayerMission(userMissionId, player.id);
		return buildResponse(result, 'Mision obtenida exitosamente', true);
	}
}
