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
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiQuery,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { JwtGuard } from '@/src/auth/app/guards/jwt.guard';
import { CurrentPlayer } from '@/src/panelApi/app/decorators/currentPlayer.decorator';
import { PlayerTokenGuard } from '@/src/panelApi/app/guards/playerToken.guard';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import {
	buildPaginatedResponse,
	buildResponse,
} from '../../../shared/libs/buildResponse';
import { PLAYER_CORE_PROVIDER } from '../../app/constants';
import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import {
	PlayerFilterDto,
	PlayerListResponseDto,
	PlayerResponseDto,
} from '../../app/dto/player.schema';
import {
	PlayerGameHistoryResponseDto,
	PlayerLastPlayedGameResponseDto,
	PlayerPlayedGamesFilterDto,
} from '../../app/dto/player-games.dto';
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
	@ApiOkResponse({ type: PlayerListResponseDto })
	@ApiQuery({ name: 'username', required: false, type: String })
	@ApiQuery({ name: 'phone', required: false, type: String })
	@ApiQuery({ name: 'levelId', required: false, type: Number })
	@ApiQuery({ name: 'minExperience', required: false, type: Number })
	@ApiQuery({ name: 'maxExperience', required: false, type: Number })
	@ApiQuery({ name: 'roomId', required: false, type: Number })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiQuery({
		name: 'orderDirection',
		required: false,
		enum: ['ASC', 'DESC'],
		description: 'Orden por fecha de creación (ASC o DESC)',
	})
	@ApiQuery({ name: 'take', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	async findAll(@Query() filter: PlayerFilterDto) {
		const response = await this.playersCore.getPlayers(filter);

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

	@Get('me')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: PlayerResponseDto })
	me(@CurrentPlayer() player: PlayerAuthContext) {
		return buildResponse(player, 'Success', true);
	}

	@Get('me/last-game')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: PlayerLastPlayedGameResponseDto })
	async getLastGame(
		@CurrentPlayer() _player: PlayerAuthContext,
		@Req() req: FastifyRequest,
	) {
		const token = this.extractTokenFromRequest(req);
		const result = await this.playersCore.getLastPlayedGame(token);
		return buildResponse(result, 'Último juego obtenido exitosamente', true);
	}

	@Get('me/games')
	@UseGuards(PlayerTokenGuard)
	@HttpCode(HttpStatus.OK)
	@ApiOkResponse({ type: PlayerGameHistoryResponseDto })
	@ApiQuery({ name: 'days', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiQuery({ name: 'from', required: false, type: String })
	@ApiQuery({ name: 'to', required: false, type: String })
	@ApiQuery({ name: 'provider', required: false, type: String })
	@ApiQuery({ name: 'gameName', required: false, type: String })
	@ApiQuery({ name: 'forceRefresh', required: false, type: Boolean })
	async getGames(
		@CurrentPlayer() player: PlayerAuthContext,
		@Query() filter: PlayerPlayedGamesFilterDto,
		@Req() req: FastifyRequest,
	) {
		const token = this.extractTokenFromRequest(req);
		const result = await this.playersCore.getPlayedGames(player, {
			...filter,
			token,
		});
		return buildResponse(result, 'Historial de juegos obtenido exitosamente', true);
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

	private extractTokenFromRequest(req: FastifyRequest): string {
		const authHeader = req.headers?.authorization;
		if (authHeader && typeof authHeader === 'string') {
			const [scheme, token] = authHeader.split(' ');
			if (scheme?.toLowerCase() === 'bearer' && token) {
				return token.trim();
			}
			return authHeader.trim();
		}
		const playerTokenHeader = req.headers?.['x-player-token'];
		if (playerTokenHeader && typeof playerTokenHeader === 'string') {
			return playerTokenHeader.trim();
		}
		const queryToken = (req.query as Record<string, unknown>)?.token;
		if (queryToken && typeof queryToken === 'string') {
			return queryToken.trim();
		}
		return '';
	}
}
