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
} from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiQuery,
} from '@nestjs/swagger';

import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { SubmitStepMultipartDto } from '../../app/dto/create-mission.dto';
import {
	PlayerMissionsQueueResponseDto,
	StepResponseDto,
	UserMissionResponseDto,
} from '../../app/dto/mission.schema';
import { MissionType, StepStatus, UserMissionStatus } from '../../app/enums';
import type { ForManagePlayerMissions } from '../../ports/driven/ForManagePlayerMissions';

@Controller('missions')
@ApiCookieAuth()
export class PlayerMisionesController {
	constructor(
		@Inject(MISIONES_CORE_PROVIDER)
		private readonly misionesCore: ForManagePlayerMissions,
	) {}

	@Post('players/:playerId/missions/:missionId/start')
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: UserMissionResponseDto })
	async startMission(
		@Param('playerId', ParseIntPipe) playerId: number,
		@Param('missionId', ParseIntPipe) missionId: number,
	) {
		const result = await this.misionesCore.startMission(playerId, missionId);
		return buildResponse(result, 'Mision iniciada exitosamente', true);
	}

	@Post('players/:playerId/missions/:userMissionId/steps/:stepId/submit')
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
	) {
		const result = await this.misionesCore.submitStep(userMissionId, stepId, dto);
		return buildResponse(result, 'Paso enviado exitosamente', true);
	}

	@Get('players/:playerId/missions')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: UserMissionResponseDto })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async getPlayerMissions(
		@Param('playerId', ParseIntPipe) playerId: number,
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const response = await this.misionesCore.getPlayerMissions(playerId, {
			take,
			skip,
		});
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

	@Get('players/:playerId/missions/:userMissionId')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: UserMissionResponseDto })
	async getPlayerMission(@Param('userMissionId', ParseIntPipe) userMissionId: number) {
		const result = await this.misionesCore.getPlayerMission(userMissionId);
		return buildResponse(result, 'Mision obtenida exitosamente', true);
	}

	@Get('admin/missions/review-queue')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: PlayerMissionsQueueResponseDto })
	@ApiQuery({
		name: 'status',
		required: false,
		enum: [...Object.values(StepStatus), ...Object.values(UserMissionStatus)],
	})
	@ApiQuery({ name: 'playerId', required: false, type: Number })
	@ApiQuery({ name: 'experience', required: false, type: Number })
	@ApiQuery({ name: 'coinsAmount', required: false, type: Number })
	@ApiQuery({ name: 'type', required: false, enum: MissionType })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async getPlayerMissionsQueue(
		@Query('status') status?: string,
		@Query('playerId', new ParseIntPipe({ optional: true })) playerId?: number,
		@Query('experience', new ParseIntPipe({ optional: true })) experience?: number,
		@Query('coinsAmount', new ParseIntPipe({ optional: true })) coinsAmount?: number,
		@Query('type') type?: string,
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const result = await this.misionesCore.getPlayerMissionsQueue({
			status,
			playerId,
			experience,
			coinsAmount,
			type,
			take,
			skip,
		});
		return buildPaginatedResponse(
			result.players,
			'Cola de revision obtenida exitosamente',
			true,
			{ skip: result.skip, limit: result.limit, total: result.total },
		);
	}

	@Post('admin/missions/steps/:stepId/review')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StepResponseDto })
	async reviewStep(
		@Param('stepId', ParseIntPipe) stepId: number,
		@Body() body: { status: 'APPROVED' | 'REJECTED'; reviewerNotes?: string },
	) {
		const result = await this.misionesCore.reviewStep(
			stepId,
			body.status === 'APPROVED' ? StepStatus.APPROVED : StepStatus.REJECTED,
			1, // TODO: get from auth context
			body.reviewerNotes,
		);
		return buildResponse(result, 'Revision completada exitosamente', true);
	}
}
