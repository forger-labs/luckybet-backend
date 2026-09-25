import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import {
	PlayerCreateResponse,
	PlayerUniqueFields,
	PlayerWithoutAudit,
} from '../../app/dto/player.schema';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';

export interface ForDatabasePlayers {
	createPlayer(playerData: CreatePlayerDto): Promise<PlayerCreateResponse>;
	findByUnique(options: PlayerUniqueFields): Promise<PlayerWithoutAudit | null>;
	getPlayers(params: {
		take?: number;
		skip?: number;
	}): Promise<[PlayerWithoutAudit[], number]>;
	updatePlayerById(
		id: number,
		playerData: UpdatePlayerDto,
	): Promise<PlayerWithoutAudit | null>;

	addExperienceAndRecalculateLevel(
		playerId: number,
		expPoints: number,
	): Promise<{
		player: PlayerWithoutAudit;
		upgradedLevel: boolean;
		newLevelId?: number;
	}>;
}
