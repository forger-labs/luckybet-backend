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
	CreateLevelDto,
	LevelFilterDto,
	LevelListResponseDto,
	LevelResponseDto,
	UpdateLevelDto,
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
	async create(@Body() createLevelDto: CreateLevelDto) {
		const level = await this.levelsCore.createLevel(createLevelDto);
		return buildResponse(level, 'Nivel creado exitosamente', true);
	}

	@Patch(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: LevelResponseDto })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() updateLevelDto: UpdateLevelDto,
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
	@ApiQuery({ name: 'bonus', required: false, type: String })
	@ApiQuery({ name: 'minCoins', required: false, type: Number })
	@ApiQuery({ name: 'maxCoins', required: false, type: Number })
	@ApiQuery({ name: 'minExperience', required: false, type: Number })
	@ApiQuery({ name: 'maxExperience', required: false, type: Number })
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
