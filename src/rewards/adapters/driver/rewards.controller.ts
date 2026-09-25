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
import { REWARDS_CORE_PROVIDER } from '../../app/constants';
import {
	MissionRewardListResponseDto,
	MissionRewardResponseDto,
	ResolveUncertainRewardDto,
} from '../../app/dto/reward.schema';
import type { ForManageRewards } from '../../ports/driven/ForManageRewards';

@Controller('rewards')
export class RewardsController {
	constructor(
		@Inject(REWARDS_CORE_PROVIDER)
		private readonly rewardsCore: ForManageRewards,
	) {}

	// ─── Player Endpoints ──────────────────────────────────────────

	@Post('user-missions/:userMissionId/claim')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: MissionRewardResponseDto })
	async claimReward(
		@Param('userMissionId', ParseIntPipe) userMissionId: number,
		@CurrentPlayer() player: PlayerAuthContext,
	) {
		const result = await this.rewardsCore.claimReward(userMissionId, player.id);
		return buildResponse(result, 'Recompensa reclamada exitosamente', true);
	}

	@Get('my-pending')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiHeader({
		name: 'Authorization',
		description: 'Bearer {playerToken} o x-player-token header',
		required: true,
	})
	@ApiOkResponse({ type: MissionRewardListResponseDto })
	async getPendingRewards(@CurrentPlayer() player: PlayerAuthContext) {
		const rewards = await this.rewardsCore.getPendingRewards(player.id);
		return buildResponse(rewards, 'Recompensas pendientes obtenidas exitosamente', true);
	}

	// ─── Admin Endpoints ───────────────────────────────────────────

	@Get('admin/uncertain')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionRewardListResponseDto })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async getUncertainRewards(
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const result = await this.rewardsCore.getUncertainRewards({ take, skip });
		return buildPaginatedResponse(
			result.rewards,
			'Recompensas en estado incierto obtenidas exitosamente',
			true,
			{ limit: result.limit, skip: result.skip, total: result.total },
		);
	}

	@Post('admin/:rewardId/resolve')
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: MissionRewardResponseDto })
	async resolveUncertainReward(
		@Param('rewardId', ParseIntPipe) rewardId: number,
		@Body() dto: ResolveUncertainRewardDto,
		@CurrentUser() admin: User,
	) {
		const result = await this.rewardsCore.resolveUncertainReward(
			rewardId,
			dto.action,
			admin.id,
			{
				externalOperationId: dto.externalOperationId,
				adminNotes: dto.adminNotes,
			},
		);
		return buildResponse(result, 'Recompensa resuelta exitosamente', true);
	}
}
