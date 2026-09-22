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
import { CurrentPlayer } from '@/src/shared/panelApi/app/decorators/currentPlayer.decorator';
import { PlayerTokenGuard } from '@/src/shared/panelApi/app/guards/playerToken.guard';
import type { PlayerAuthContext } from '@/src/shared/panelApi/types/panelApiCore.types';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { PLAYER_CORE_PROVIDER } from '../../app/constants';
import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import { PlayerListResponseDto, PlayerResponseDto } from '../../app/dto/player.schema';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';
import type { ForManagePlayers } from '../../ports/driven/ForManagePlayers';

@Controller('players')
export class PlayersController {
	constructor(
		@Inject(PLAYER_CORE_PROVIDER)
		private readonly playersCore: ForManagePlayers,
	) {}

	@Post()
	@ApiCookieAuth()
	@HttpCode(HttpStatus.CREATED)
	@ApiCreatedResponse({ type: PlayerResponseDto })
	async create(@Body() createPlayerDto: CreatePlayerDto) {
		const player = await this.playersCore.createPlayer(createPlayerDto);

		return buildResponse(player, 'Player created successfully', true);
	}

	@Get()
	@ApiCookieAuth()
	@HttpCode(HttpStatus.OK)
	@ApiCreatedResponse({ type: PlayerListResponseDto })
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async findAll(
		@Query('take', new ParseIntPipe({ optional: true })) take?: number,
		@Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
	) {
		const response = await this.playersCore.getPlayers({ take, skip });

		return buildPaginatedResponse(
			response.players,
			'Players obtenidos exitosamente',
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
	@UseGuards(JwtGuard)
	@ApiCreatedResponse({ type: PlayerResponseDto })
	async findOne(@Param('id', new ParseIntPipe({ optional: true })) id: number) {
		const player = await this.playersCore.findById(id);
		return buildResponse(player, 'Player obtenido exitosamente', true);
	}

	@Patch(':id')
	@HttpCode(HttpStatus.OK)
	@UseGuards(JwtGuard)
	@ApiCreatedResponse({ type: PlayerResponseDto })
	async update(
		@Param('id', new ParseIntPipe({ optional: true })) id: number,
		@Body() updatePlayerDto: UpdatePlayerDto,
	) {
		const player = await this.playersCore.updatePlayerById(id, updatePlayerDto);

		return buildResponse(player, 'Player editado exitosamente', true);
	}

	@Get('me')
	@UseGuards(PlayerTokenGuard)
	@ApiOkResponse({ type: PlayerResponseDto })
	me(@CurrentPlayer() player: PlayerAuthContext) {
		return buildResponse(player, 'Success', true);
	}
}
