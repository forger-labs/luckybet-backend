import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import type {
	PlayerCreateResponse,
	PlayerFilter,
	PlayerUniqueFields,
	PlayerWithoutAudit,
} from '../../app/dto/player.schema';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';

export interface ForDatabasePlayers {
	createPlayer(playerData: CreatePlayerDto): Promise<PlayerCreateResponse>;
	findByUnique(options: PlayerUniqueFields): Promise<PlayerWithoutAudit | null>;
	getPlayers(filter?: PlayerFilter): Promise<[PlayerWithoutAudit[], number]>;
	updatePlayerById(
		id: number,
		playerData: UpdatePlayerDto,
	): Promise<PlayerWithoutAudit | null>;
	addExperience(
		playerId: number,
		expPoints: number,
	): Promise<{
		player: PlayerWithoutAudit;
		previousExperience: number;
		newExperience: number;
	}>;
	updateLevel(playerId: number, levelId: number): Promise<PlayerWithoutAudit>;
}
