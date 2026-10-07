import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
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

import { JwtGuard } from '@/src/auth/app/guards/jwt.guard';
import { RolesGuard } from '@/src/auth/app/guards/roles.guard';
import { Roles } from '@/src/auth/decorators/roles.decorator';
import { buildPaginatedResponse, buildResponse } from '@/src/shared/libs/buildResponse';
import { AdminRoles } from '@/src/users/app/entities/user.entity';
import { LEVELS_CORE_PROVIDER } from '../../app/constants';
import {
	CreateLevelMultipartDto,
	LevelFilterDto,
	LevelListResponseDto,
	LevelResponseDto,
	UpdateLevelMultipartDto,
} from '../../app/dto/level.schema';
import type { ForManageLevels } from '../../ports/drivens/forManageLevels';

@Controller('levels')
export class LevelsController {
	constructor(
		@Inject(LEVELS_CORE_PROVIDER)
		private readonly levelsCore: ForManageLevels,
	) {}

	@Post()
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: LevelResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['name', 'minExperience', 'coins', 'image'],
			properties: {
				name: { type: 'string' },
				minExperience: { type: 'number' },
				coins: { type: 'number' },
				bonus: {
					type: 'string',
					enum: ['0', '30', '40', '50', '100', '150', '200'],
				},
				image: { type: 'string', format: 'binary' },
			},
		},
	})
	async create(@Body() createLevelDto: CreateLevelMultipartDto) {
		const level = await this.levelsCore.createLevel(createLevelDto);
		return buildResponse(level, 'Nivel creado exitosamente', true);
	}

	@Patch(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: LevelResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				minExperience: { type: 'number' },
				coins: { type: 'number' },
				bonus: {
					type: 'string',
					enum: ['0', '30', '40', '50', '100', '150', '200'],
				},
				image: { type: 'string', format: 'binary' },
			},
		},
	})
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() updateLevelDto: UpdateLevelMultipartDto,
	) {
		const level = await this.levelsCore.updateLevel(id, updateLevelDto);
		return buildResponse(level, 'Nivel actualizado exitosamente', true);
	}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: LevelListResponseDto })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	@ApiQuery({ name: 'name', required: false, type: String })
	@ApiQuery({ name: 'roomId', required: false, type: Number })
	@ApiQuery({ name: 'minCoins', required: false, type: Number })
	@ApiQuery({ name: 'maxCoins', required: false, type: Number })
	@ApiQuery({ name: 'minExperience', required: false, type: Number })
	@ApiQuery({ name: 'maxExperience', required: false, type: Number })
	@ApiQuery({
		name: 'sortOrder',
		required: false,
		enum: ['ASC', 'DESC'],
		description: 'Orden por experiencia mínima (ASC o DESC, por defecto ASC)',
	})
	async findAll(
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
		@Query() filter?: LevelFilterDto,
	) {
		const response = await this.levelsCore.getLevels({
			take,
			skip,
			filter,
		});

		return buildPaginatedResponse(
			response.levels,
			'Niveles obtenidos exitosamente',
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
	@ApiOkResponse({ type: LevelResponseDto })
	async findOne(@Param('id', ParseIntPipe) id: number) {
		const level = await this.levelsCore.getLevelById(id);
		return buildResponse(level, 'Nivel obtenido exitosamente', true);
	}
}
