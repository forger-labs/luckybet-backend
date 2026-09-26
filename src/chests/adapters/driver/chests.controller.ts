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
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import type { UploadableFile } from '../../../shared/storage/storage.port';
import { AdminRoles } from '../../../users/app/entities/user.entity';
import { CHESTS_CORE_PROVIDER } from '../../app/constants';
import {
	ChestListResponseDto,
	ChestResponseDto,
	CreateChestDto,
	FilterChestDTO,
	UpdateChestDto,
} from '../../app/dto/chest.schema';
import { ChestPeriodType } from '../../app/enums';
import type { ForManageChests } from '../../ports/driven/ForManageChests';

@Controller('chests')
export class ChestsController {
	constructor(
		@Inject(CHESTS_CORE_PROVIDER)
		private readonly chestsCore: ForManageChests,
	) {}

	@Get()
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestListResponseDto })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	@ApiQuery({ name: 'periodType', required: false, enum: ChestPeriodType })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiQuery({ name: 'title', required: false, type: String })
	async listChests(@Query() filter: FilterChestDTO) {
		const result = await this.chestsCore.listChests(filter);
		return buildPaginatedResponse(
			result.chests,
			'Listado de cofres obtenido exitosamente',
			true,
			{ limit: result.limit, skip: result.skip, total: result.total },
		);
	}

	@Get(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestResponseDto })
	async getChest(@Param('id', ParseIntPipe) id: number) {
		const chest = await this.chestsCore.getChest(id);
		return buildResponse(chest, 'Cofre obtenido exitosamente', true);
	}

	@Post()
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: ChestResponseDto })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: [
				'title',
				'periodType',
				'requiredMissions',
				'coinsAmount',
				'experiencePoints',
			],
			properties: {
				title: { type: 'string' },
				description: { type: 'string' },
				periodType: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
				requiredMissions: { type: 'number' },
				coinsAmount: { type: 'number' },
				experiencePoints: { type: 'number' },
				isActive: { type: 'boolean' },
				image: { type: 'string', format: 'binary' },
			},
		},
	})
	async createChest(@Body() dto: CreateChestDto, @Req() req: FastifyRequest) {
		const image = (req.body as { image?: UploadableFile } | undefined)?.image;
		const chest = await this.chestsCore.createChest(dto, image);
		return buildResponse(chest, 'Cofre creado exitosamente', true);
	}

	@Patch(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestResponseDto })
	async updateChest(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChestDto) {
		const chest = await this.chestsCore.updateChest(id, dto);
		return buildResponse(chest, 'Cofre actualizado exitosamente', true);
	}

	@Post(':id/image')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestResponseDto })
	@ApiConsumes('multipart/form-data')
	async replaceImage(@Param('id', ParseIntPipe) id: number, @Req() req: FastifyRequest) {
		const file = (req.body as { file?: UploadableFile } | undefined)?.file;
		if (!file) {
			throw new BadRequestException('No se recibio ningun archivo');
		}
		const chest = await this.chestsCore.replaceChestImage(id, file);
		return buildResponse(chest, 'Imagen de cofre reemplazada exitosamente', true);
	}

	@Delete(':id/image')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestResponseDto })
	async deleteImage(@Param('id', ParseIntPipe) id: number) {
		const chest = await this.chestsCore.deleteChestImage(id);
		return buildResponse(chest, 'Imagen de cofre eliminada exitosamente', true);
	}

	@Patch(':id/status')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ChestResponseDto })
	async toggleActive(
		@Param('id', ParseIntPipe) id: number,
		@Body() body: { isActive: boolean },
	) {
		const chest = await this.chestsCore.toggleChestActive(id, body.isActive);
		return buildResponse(chest, 'Estado de cofre actualizado exitosamente', true);
	}
}
