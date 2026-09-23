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

import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import type { UploadableFile } from '../../../shared/storage/storage.port';
import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { CreateMissionMultipartDto } from '../../app/dto/create-mission.dto';
import { MissionListResponseDto, MissionResponseDto } from '../../app/dto/mission.schema';
import { UpdateMissionDto } from '../../app/dto/update-mission.dto';
import type { MissionStatus } from '../../app/enums';
import type { ForManageMissions } from '../../ports/driven/ForManageMissions';

@Controller('missions')
@ApiCookieAuth()
export class MissionsController {
	constructor(
		@Inject(MISIONES_CORE_PROVIDER)
		private readonly misionesCore: ForManageMissions,
	) {}

	@Post()
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
				bonus: { type: 'string' },
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
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async findAll(
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const response = await this.misionesCore.listMissions({ take, skip });
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

	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async findOne(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.getMission(id);
		return buildResponse(mission, 'Mision obtenida exitosamente', true);
	}

	@Patch(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMissionDto) {
		const mission = await this.misionesCore.updateMission(id, dto);
		return buildResponse(mission, 'Mision actualizada exitosamente', true);
	}

	@Post(':id/activate')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async activate(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.activateMission(id);
		return buildResponse(mission, 'Mision activada exitosamente', true);
	}

	@Patch(':id/status')
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
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionResponseDto })
	async deleteImage(@Param('id', ParseIntPipe) id: number) {
		const mission = await this.misionesCore.deleteMissionImage(id);
		return buildResponse(mission, 'Imagen eliminada exitosamente', true);
	}
}
