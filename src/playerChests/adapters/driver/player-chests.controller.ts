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
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

import { JwtGuard } from '../../../auth/app/guards/jwt.guard';
import { RolesGuard } from '../../../auth/app/guards/roles.guard';
import { CurrentUser } from '../../../auth/decorators/currentUser.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { ChestPeriodType } from '../../../chests/app/enums';
import { CurrentPlayer } from '../../../panelApi/app/decorators/currentPlayer.decorator';
import { PlayerTokenGuard } from '../../../panelApi/app/guards/playerToken.guard';
import type { PlayerAuthContext } from '../../../panelApi/types/panelApiCore.types';
import { RewardStatus } from '../../../rewards/app/enums';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { AdminRoles, type User } from '../../../users/app/entities/user.entity';
import { PLAYER_CHESTS_CORE_PROVIDER } from '../../app/constants';
import {
	ClaimChestResponseDto,
	PlayerChestFilterDto,
	PlayerChestProgressFilterDto,
	PlayerChestProgressResponseDto,
	ResolveUncertainChestClaimDto,
	SinglePlayerChestProgressResponseDto,
	UserMissionChestListResponseDto,
} from '../../app/dto/player-chest.schema';
import type { ForManagePlayerChests } from '../../ports/driven/ForManagePlayerChests';

@Controller('player-chests')
export class PlayerChestsController {
	constructor(
		@Inject(PLAYER_CHESTS_CORE_PROVIDER)
		private readonly playerChestsCore: ForManagePlayerChests,
	) {}

	// ─── Player Endpoints ──────────────────────────────────────────

	@Get('progress')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: PlayerChestProgressResponseDto })
	@ApiQuery({ name: 'periodType', required: false, enum: ChestPeriodType })
	@ApiQuery({ name: 'chestId', required: false, type: Number })
	async getProgress(
		@CurrentPlayer() player: PlayerAuthContext,
		@Query() filter: PlayerChestProgressFilterDto,
	) {
		const progress = await this.playerChestsCore.getPlayerChestsProgress(
			player.id,
			filter,
		);
		return buildResponse(progress, 'Progreso de cofres obtenido exitosamente', true);
	}

	@Get(':chestId/progress')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: SinglePlayerChestProgressResponseDto })
	async getChestProgress(
		@Param('chestId', ParseIntPipe) chestId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const progress = await this.playerChestsCore.getChestProgressById(chestId, player.id);
		return buildResponse(progress, 'Progreso de cofre obtenido exitosamente', true);
	}

	@Post(':chestId/join')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: ClaimChestResponseDto })
	async joinChest(
		@Param('chestId', ParseIntPipe) chestId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const result = await this.playerChestsCore.joinChest(chestId, player.id);
		return buildResponse(
			result,
			'Participación en el cofre registrada exitosamente',
			true,
		);
	}

	@Get()
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: UserMissionChestListResponseDto })
	async listPlayerChests(
		@CurrentPlayer() player: PlayerAuthContext,
		@Query() filter: PlayerChestFilterDto,
	) {
		const { claims, total, limit, skip } = await this.playerChestsCore.listPlayerChests(
			player.id,
			filter,
		);
		return buildPaginatedResponse(
			claims,
			'Historial de cofres del jugador obtenido exitosamente',
			true,
			{ total, limit, skip },
		);
	}

	@Post(':chestId/claim')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: ClaimChestResponseDto })
	async claimChest(
		@Param('chestId', ParseIntPipe) chestId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const claim = await this.playerChestsCore.claimChest(chestId, player.id);
		return buildResponse(claim, 'Cofre reclamado exitosamente', true);
	}

	// ─── Admin Endpoints ───────────────────────────────────────────

	@Get('admin')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: UserMissionChestListResponseDto })
	@ApiQuery({ name: 'playerId', required: false, type: Number })
	@ApiQuery({ name: 'chestId', required: false, type: Number })
	@ApiQuery({ name: 'status', required: false, enum: RewardStatus })
	@ApiQuery({ name: 'periodKey', required: false, type: String })
	@ApiQuery({ name: 'orderBy', required: false, enum: ['created_at', 'periodKey', 'id'] })
	@ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'] })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async listAdminChests(@Query() filter: PlayerChestFilterDto) {
		const {
			claims,
			total,
			limit,
			skip: offset,
		} = await this.playerChestsCore.listAllChests(filter);
		return buildPaginatedResponse(
			claims,
			'Reclamos de cofres obtenidos exitosamente',
			true,
			{ total, limit, skip: offset },
		);
	}

	@Post('admin/:claimId/resolve')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: ClaimChestResponseDto })
	async resolveUncertainClaim(
		@Param('claimId', ParseIntPipe) claimId: number,
		@Body() dto: ResolveUncertainChestClaimDto,
		@CurrentUser() admin: User,
	) {
		const resolved = await this.playerChestsCore.resolveUncertainClaim(
			claimId,
			dto.action,
			admin.id,
			{
				externalOperationId: dto.externalOperationId,
				adminNotes: dto.adminNotes,
			},
		);
		return buildResponse(resolved, 'Reclamo de cofre resuelto exitosamente', true);
	}
}
