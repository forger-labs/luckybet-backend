import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { buildResponse } from '@/src/shared/libs/buildResponse';
import { CurrentToken } from '../../app/decorators/currentPlayer.decorator';
import { LuckyBetGameItemResponseDTO } from '../../app/dtos/game.schema';
import { PlayerTokenGuard } from '../../app/guards/playerToken.guard';
import { FOR_USER_PANEL } from '../../constants';
import type { ForUserPanel } from '../../panel.port';

@Controller('panel')
export class PanelController {
	constructor(
		@Inject(FOR_USER_PANEL)
		private readonly userPanel: ForUserPanel,
	) {}

	@Get('/games')
	// @UseGuards(PlayerTokenGuard)
	@ApiOkResponse({
		type: LuckyBetGameItemResponseDTO,
	})
	async gameList(@CurrentToken() token: string) {
		const gameList = await this.userPanel.getGameList('');

		return buildResponse(gameList, 'Lista de juegos obtenida', true);
	}
}
