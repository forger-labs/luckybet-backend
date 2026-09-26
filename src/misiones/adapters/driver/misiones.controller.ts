import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiQuery,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { JwtGuard } from '../../../auth/app/guards/jwt.guard';
import { RolesGuard } from '../../../auth/app/guards/roles.guard';
import { CurrentUser } from '../../../auth/decorators/currentUser.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import type { UploadableFile } from '../../../shared/storage/storage.port';
import { AdminRoles, type User } from '../../../users/app/entities/user.entity';
import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { CreateMissionMultipartDto } from '../../app/dto/create-mission.dto';
import {
	MissionFilterDto,
	MissionListResponseDto,
	MissionResponseDto,
	PlayerMissionsQueueResponseDto,
	StepResponseDto,
} from '../../app/dto/mission.schema';
import { UpdateMissionDto } from '../../app/dto/update-mission.dto';
import {
	MissionStatus,
	MissionType,
	StepStatus,
	UserMissionStatus,
} from '../../app/enums';
import type { ForManageMissions } from '../../ports/driven/ForManageMissions';
import type { ForManagePlayerMissions } from '../../ports/driven/ForManagePlayerMissions';

@Controller('missions')
@ApiCookieAuth()
export class MissionsController {
	constructor(
		@Inject(MISIONES_CORE_PROVIDER)
		private readonly misionesCore: ForManageMissions & ForManagePlayerMissions,
	) {}

	@Post()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: MissionResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['image'],
			properties: {
				title: { type: 'string' },
				description: { type: 'string' },
				type: { type: 'string', enum: ['DAILY', 'WEEKLY', 'FIXED'] },
				coinsAmount: { type: 'string' },
				roomId: { type: 'number' },
				experiencePoints: { type: 'string' },
				missionSteps: { type: 'string' },
				image: { type: 'string', format: 'binary' },
			},
		},
	})
	async create(@Body() dto: CreateMissionMultipartDto) {
		const mission = await this.misionesCore.createMission(dto);
		return buildResponse(mission, 'Mision creada exitosamente', true);
	}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionListResponseDto })
	@ApiQuery({ name: 'title', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, enum: MissionType })
	@ApiQuery({ name: 'status', required: false, enum: MissionStatus })
	@ApiQuery({ name: 'roomId', required: false, type: Number })
	@ApiQuery({ name: 'minCoins', required: false, type: Number })
	@ApiQuery({ name: 'maxCoins', required: false, type: Number })
	@ApiQuery({ name: 'minExperience', required: false, type: Number })
	@ApiQuery({ name: 'maxExperience', required: false, type: Number })
	@ApiQuery({
		name: 'orderDirection',
		required: false,
		enum: ['ASC', 'DESC'],
		description: 'Orden por fecha de creación (ASC o DESC)',
	})
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async findAll(@Query() filter: MissionFilterDto) {
		const response = await this.misionesCore.listMissions(filter);
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

	@Get('admin/review-queue')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
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

	@Post('admin/steps/:stepId/review')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: StepResponseDto })
	async reviewStep(
		@Param('stepId', ParseIntPipe) stepId: number,
		@Body() body: { status: 'APPROVED' | 'REJECTED'; reviewerNotes?: string },
		@CurrentUser() admin: User,
	) {
		const result = await this.misionesCore.reviewStep(
			stepId,
			body.status === 'APPROVED' ? StepStatus.APPROVED : StepStatus.REJECTED,
			admin.id,
			body.reviewerNotes,
		);
		return buildResponse(result, 'Revision completada exitosamente', true);
	}

	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async findOne(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.getMission(id);
		return buildResponse(mission, 'Mision obtenida exitosamente', true);
	}

	@Patch(':id')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMissionDto) {
		const mission = await this.misionesCore.updateMission(id, dto);
		return buildResponse(mission, 'Mision actualizada exitosamente', true);
	}

	@Post(':id/activate')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async activate(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.activateMission(id);
		return buildResponse(mission, 'Mision activada exitosamente', true);
	}

	@Patch(':id/status')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async changeStatus(
		@Param('id', ParseIntPipe) id: number,
		@Body() body: { status: MissionStatus },
	) {
		const mission = await this.misionesCore.changeMissionStatus(id, body.status);
		return buildResponse(mission, 'Estado actualizado exitosamente', true);
	}

	@Post(':id/image')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
			},
		},
	})
	async replaceImage(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
		const file = (req.body as { file?: UploadableFile } | undefined)?.file;
		if (!file) {
			throw new BadRequestException('No se recibio ningun archivo');
		}
		const mission = await this.misionesCore.replaceMissionImage(id, file);
		return buildResponse(mission, 'Imagen reemplazada exitosamente', true);
	}

	@Delete(':id/image')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async deleteImage(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.deleteMissionImage(id);
		return buildResponse(mission, 'Imagen eliminada exitosamente', true);
	}
}
