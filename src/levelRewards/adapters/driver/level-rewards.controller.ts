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
import { CurrentPlayer } from '../../../panelApi/app/decorators/currentPlayer.decorator';
import { PlayerTokenGuard } from '../../../panelApi/app/guards/playerToken.guard';
import type { PlayerAuthContext } from '../../../panelApi/types/panelApiCore.types';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { AdminRoles, type User } from '../../../users/app/entities/user.entity';
import { LEVEL_REWARDS_CORE_PROVIDER } from '../../app/constants';
import {
	LevelRewardFilterDto,
	LevelRewardListResponseDto,
	ResolveUncertainLevelClaimDto,
	SingleLevelRewardResponseDto,
} from '../../app/dto/level-reward.schema';
import type { ForManageLevelRewards } from '../../ports/driven/ForManageLevelRewards';

@Controller('level-rewards')
export class LevelRewardsController {
	constructor(
		@Inject(LEVEL_REWARDS_CORE_PROVIDER)
		private readonly levelRewardsCore: ForManageLevelRewards,
	) {}

	// ─── Player Endpoints ──────────────────────────────────────────

	@Get()
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: LevelRewardListResponseDto })
	async listPlayerRewards(
		@CurrentPlayer() player: PlayerAuthContext,
		@Query() filter: LevelRewardFilterDto,
	) {
		const { rewards, total, limit, skip } = await this.levelRewardsCore.listPlayerRewards(
			player.id,
			filter,
		);
		return buildPaginatedResponse(
			rewards,
			'Historial de recompensas de nivel obtenido exitosamente',
			true,
			{ total, limit, skip },
		);
	}

	@Post(':levelId/claim')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: SingleLevelRewardResponseDto })
	async claimLevelReward(
		@Param('levelId', ParseIntPipe) levelId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const claim = await this.levelRewardsCore.claimLevelReward(levelId, player.id);
		return buildResponse(claim, 'Premio de nivel reclamado exitosamente', true);
	}

	// ─── Admin Endpoints ───────────────────────────────────────────

	@Get('admin/uncertain')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	@ApiOkResponse({ type: LevelRewardListResponseDto })
	async getUncertainClaims(
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const {
			claims,
			total,
			limit,
			skip: offset,
		} = await this.levelRewardsCore.getUncertainClaims({ take, skip });
		return buildPaginatedResponse(
			claims,
			'Reclamos de nivel inciertos obtenidos exitosamente',
			true,
			{ total, limit, skip: offset },
		);
	}

	@Post('admin/:claimId/resolve')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: SingleLevelRewardResponseDto })
	async resolveUncertainClaim(
		@Param('claimId', ParseIntPipe) claimId: number,
		@Body() dto: ResolveUncertainLevelClaimDto,
		@CurrentUser() admin: User,
	) {
		const resolved = await this.levelRewardsCore.resolveUncertainClaim(
			claimId,
			dto.action,
			admin.id,
			{
				externalOperationId: dto.externalOperationId,
				adminNotes: dto.adminNotes,
			},
		);
		return buildResponse(resolved, 'Reclamo de nivel resuelto exitosamente', true);
	}
}
