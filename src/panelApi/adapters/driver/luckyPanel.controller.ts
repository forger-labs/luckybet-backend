import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { buildResponse } from '@/src/shared/libs/buildResponse';
import {
	LuckyBetGameItemResponseDTO,
	LuckyBetProvidersResponseDTO,
} from '../../app/dtos/game.schema';
import { FOR_PANEL_API_CORE } from '../../constants';
import type { ForPanelApiCore } from '../../ports/forPanelApiCore.port';

@Controller('panel')
export class PanelController {
	constructor(
		@Inject(FOR_PANEL_API_CORE)
		private readonly panelApi: ForPanelApiCore,
	) {}

	@Get('/games')
	@ApiOkResponse({
		type: LuckyBetGameItemResponseDTO,
	})
	async gameList() {
		const gameList = await this.panelApi.getGameList();

		return buildResponse(gameList, 'Lista de juegos obtenida', true);
	}

	@Get('/providers')
	@ApiOkResponse({
		type: LuckyBetProvidersResponseDTO,
	})
	async getProviders() {
		const providers = await this.panelApi.getProviders();

		return buildResponse(providers, 'Lista de proveedores obtenida exitosamente', true);
	}
}
