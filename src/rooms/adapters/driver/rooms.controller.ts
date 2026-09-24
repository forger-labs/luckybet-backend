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

import { JwtGuard } from '../../../auth/app/guards/jwt.guard';
import { RolesGuard } from '../../../auth/app/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { BonusIntern } from '../../../types/bonus';
import { AdminRoles } from '../../../users/app/entities/user.entity';
import { ROOMS_CORE_PROVIDER } from '../../app/constants';
import {
	ActiveRoomsResponseDto,
	CreateRoomDto,
	RoomListResponseDto,
	RoomQueryFilterDto,
	RoomResponseDto,
	UpdateRoomDto,
} from '../../app/dto/room.schema';
import type { ForManageRooms } from '../../ports/driven/ForManageRooms';

@Controller('rooms')
export class RoomsController {
	constructor(
		@Inject(ROOMS_CORE_PROVIDER)
		private readonly roomsCore: ForManageRooms,
	) {}

	@Get('active')
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ActiveRoomsResponseDto })
	async getActiveRooms() {
		const rooms = await this.roomsCore.getActiveRooms();
		return buildResponse(rooms, 'Salas activas obtenidas exitosamente', true);
	}

	@Get()
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: RoomListResponseDto })
	@ApiQuery({ name: 'name', required: false, type: String })
	@ApiQuery({ name: 'bonus', required: false, enum: BonusIntern })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async listRooms(@Query() filter: RoomQueryFilterDto) {
		const result = await this.roomsCore.listRooms(filter);
		return buildPaginatedResponse(
			result.rooms,
			'Listado de salas obtenido exitosamente',
			true,
			{ limit: result.limit, skip: result.skip, total: result.total },
		);
	}

	@Get(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: RoomResponseDto })
	async getRoom(@Param('id', ParseIntPipe) id: number) {
		const room = await this.roomsCore.getRoom(id);
		return buildResponse(room, 'Sala obtenida exitosamente', true);
	}

	@Post()
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: RoomResponseDto })
	async createRoom(@Body() dto: CreateRoomDto) {
		const room = await this.roomsCore.createRoom(dto);
		return buildResponse(room, 'Sala creada exitosamente', true);
	}

	@Patch(':id')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: RoomResponseDto })
	async updateRoom(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateRoomDto,
	) {
		const room = await this.roomsCore.updateRoom(id, dto);
		return buildResponse(room, 'Sala actualizada exitosamente', true);
	}

	@Patch(':id/status')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: RoomResponseDto })
	async toggleActive(
		@Param('id', ParseIntPipe) id: number,
		@Body() body: { isActive: boolean },
	) {
		const room = await this.roomsCore.toggleRoomActive(id, body.isActive);
		return buildResponse(room, 'Estado de la sala actualizado exitosamente', true);
	}
}
