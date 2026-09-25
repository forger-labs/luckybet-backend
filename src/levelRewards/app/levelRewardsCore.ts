import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';

import { LEVELS_CORE_PROVIDER } from '../../levels/app/constants';
import type { ForManageLevels } from '../../levels/ports/drivens/forManageLevels';
import { FOR_PANEL_API_CORE } from '../../panelApi/constants';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import { PlayerRepoService } from '../../players/adapters/driven/PlayerRepo.service';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { RewardAction, RewardStatus } from '../../rewards/app/enums';
import { FOR_DATABASE_ROOMS } from '../../rooms/app/constants';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
import type { ForManageLevelRewards } from '../ports/driven/ForManageLevelRewards';
import type { ForDatabaseLevelRewards } from '../ports/driver/ForDatabaseLevelRewards';
import { FOR_DATABASE_LEVEL_REWARDS } from './constants';
import {
	type LevelRewardBasic,
	type LevelRewardFilter,
} from './dto/level-reward.schema';

@Injectable()
export class LevelRewardsCore implements ForManageLevelRewards {
	private readonly logger = new Logger(LevelRewardsCore.name);

	constructor(
		@Inject(FOR_DATABASE_LEVEL_REWARDS)
		private readonly rewardRepo: ForDatabaseLevelRewards,
		@Inject(LEVELS_CORE_PROVIDER)
		private readonly levelsCore: ForManageLevels,
		@Inject(FOR_PANEL_API_CORE)
		private readonly panelApi: ForPanelApiCore,
		@Inject(PlayerRepoService)
		private readonly playerRepo: ForDatabasePlayers,
		@Inject(FOR_DATABASE_ROOMS)
		private readonly roomRepo: ForDatabaseRooms,
	) {}

	/**
	 * Reclama la recompensa asociada a la subida de un nivel.
	 * Aplica el protocolo blindado de transferencia temporal a la sala del nivel y retorno a la sala base.
	 */
	async claimLevelReward(levelId: number, playerId: number): Promise<LevelRewardBasic> {
		// Validar existencia del nivel
		const level = await this.levelsCore.getLevelById(levelId);
		if (!level) {
			throw new NotFoundException(`El nivel con ID ${levelId} no existe`);
		}

		// Validar que el jugador efectivamente haya alcanzado este nivel
		const player = await this.playerRepo.findByUnique({ id: playerId });
		if (!player) {
			throw new NotFoundException(`Jugador con ID ${playerId} no encontrado`);
		}

		if (!player.levelId || player.levelId < levelId) {
			throw new BadRequestException(
				'Aún no has alcanzado este nivel para reclamar su premio',
			);
		}

		// Buscar si ya existe la recompensa o adquirir el bloqueo atómico
		let locked = await this.rewardRepo.findByPlayerAndLevel(playerId, levelId);

		if (locked) {
			if (locked.status === RewardStatus.CLAIMED) {
				throw new BadRequestException('Ya has reclamado la recompensa de este nivel');
			}
			if (locked.status === RewardStatus.TIMEOUT_UNCERTAIN) {
				throw new BadRequestException(
					'El reclamo de este nivel se encuentra en revisión por el equipo de administración',
				);
			}
			if (locked.status === RewardStatus.PROCESSING) {
				throw new ConflictException(
					'El premio de este nivel ya está siendo procesado en este momento',
				);
			}
			locked = await this.rewardRepo.updateStatus(locked.id, RewardStatus.PROCESSING);
		} else {
			locked = await this.rewardRepo.acquireClaimLock({
				playerId,
				levelId,
				coinsAmount: level.coins ?? 0,
				roomId: level.roomId,
				status: RewardStatus.PROCESSING,
			});
		}

		if (!locked) {
			throw new ConflictException('El premio ya está siendo procesado o fue reclamado');
		}

		const coinsAmount = locked.coinsAmount;
		const roomId = locked.roomId;

		// Si el nivel no otorga monedas, marcar como reclamado directamente
		if (coinsAmount <= 0) {
			return await this.rewardRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
				claimedAt: new Date(),
			});
		}

		const playerIdentifier = player.username || String(playerId);
		const baseRoom = player.room;
		let transferredToTarget = false;

		// 1. Si el nivel tiene una sala asignada, transferir al jugador temporalmente
		if (roomId && this.roomRepo) {
			const targetRoom = await this.roomRepo.findById(roomId);
			if (targetRoom?.isActive) {
				const success = await this.panelApi
					.changePlayerSenior(playerIdentifier, targetRoom.name)
					.catch(err => {
						this.logger.error(
							`Error al transferir jugador a sala de nivel [${targetRoom.name}]:`,
							err,
						);
						return false;
					});

				if (!success) {
					return await this.rewardRepo.updateStatus(
						locked.id,
						RewardStatus.TIMEOUT_UNCERTAIN,
						{
							errorMessage: `Fallo al transferir a la sala promocional del nivel [${targetRoom.name}] antes de acreditar`,
						},
					);
				}
				transferredToTarget = true;
			}
		}

		// 2. Acreditar fichas en LuckyBet
		let mutationResult: {
			success: boolean;
			operationId?: string | null;
			errorMessage?: string;
		} | null = null;
		try {
			mutationResult = await this.panelApi.creditPlayer(playerIdentifier, coinsAmount);
		} catch (error) {
			this.logger.error(
				`Timeout/Fallo de red en LuckyBet para level reward claim ${locked.id}:`,
				error,
			);

			if (transferredToTarget && baseRoom) {
				await this.panelApi
					.changePlayerSenior(playerIdentifier, baseRoom.name)
					.catch(err =>
						this.logger.error(
							`Error al regresar al jugador a su sala base [${baseRoom.name}] tras nivel:`,
							err,
						),
					);
			}

			return await this.rewardRepo.updateStatus(
				locked.id,
				RewardStatus.TIMEOUT_UNCERTAIN,
				{
					errorMessage:
						error instanceof Error
							? error.message
							: 'Error desconocido de conexión al acreditar premio de nivel',
				},
			);
		}

		if (!mutationResult.success) {
			this.logger.error(
				`Error en LuckyBet acreditando premio de nivel: ${mutationResult.errorMessage}`,
			);
			if (transferredToTarget && baseRoom) {
				await this.panelApi
					.changePlayerSenior(playerIdentifier, baseRoom.name)
					.catch(() => undefined);
			}
			return await this.rewardRepo.updateStatus(locked.id, RewardStatus.PENDING, {
				errorMessage: mutationResult.errorMessage ?? 'Error al acreditar saldo de nivel',
			});
		}

		// 3. Retorno obligatorio a la sala base del jugador
		if (transferredToTarget && baseRoom) {
			const returned = await this.panelApi
				.changePlayerSenior(playerIdentifier, baseRoom.name)
				.catch(err => {
					this.logger.error(
						`Error al regresar al jugador a su sala base [${baseRoom.name}] tras nivel:`,
						err,
					);
					return false;
				});

			if (!returned) {
				return await this.rewardRepo.updateStatus(
					locked.id,
					RewardStatus.TIMEOUT_UNCERTAIN,
					{
						externalOperationId: mutationResult.operationId ?? null,
						errorMessage: `Fichas de nivel acreditadas (Op: ${mutationResult.operationId}) pero falló el retorno a la sala base [${baseRoom.name}]`,
						claimedAt: new Date(),
					},
				);
			}
		}

		return await this.rewardRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
			externalOperationId: mutationResult.operationId ?? null,
			claimedAt: new Date(),
		});
	}

	async listPlayerRewards(
		playerId: number,
		filter: LevelRewardFilter,
	): Promise<{
		rewards: LevelRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [rewards, total] = await this.rewardRepo.getPlayerRewards(playerId, filter);
		return {
			rewards,
			total,
			limit: filter.take ?? 50,
			skip: filter.skip ?? 0,
		};
	}

	async getUncertainClaims(params?: { take?: number; skip?: number }): Promise<{
		claims: LevelRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [claims, total] = await this.rewardRepo.findUncertainClaims(params);
		return {
			claims,
			total,
			limit: params?.take ?? 50,
			skip: params?.skip ?? 0,
		};
	}

	async resolveUncertainClaim(
		claimId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<LevelRewardBasic> {
		const claim = await this.rewardRepo.findById(claimId);
		if (!claim) {
			throw new NotFoundException(`Reclamo de nivel con ID ${claimId} no encontrado`);
		}
		if (claim.status !== RewardStatus.TIMEOUT_UNCERTAIN) {
			throw new BadRequestException(
				`Solo se pueden resolver reclamos en estado TIMEOUT_UNCERTAIN (actual: ${claim.status})`,
			);
		}

		if (action === 'RESOLVE_CLAIMED') {
			return await this.rewardRepo.updateStatus(claim.id, RewardStatus.CLAIMED, {
				resolvedByAdminId: adminId,
				externalOperationId: options?.externalOperationId ?? claim.externalOperationId,
				claimedAt: new Date(),
			});
		}

		if (action === 'FORCE_RETRY') {
			return await this.rewardRepo.updateStatus(claim.id, RewardStatus.PENDING, {
				resolvedByAdminId: adminId,
				errorMessage: options?.adminNotes
					? `Reintento forzado por admin ${adminId}: ${options.adminNotes}`
					: `Reintento forzado por admin ${adminId}`,
			});
		}

		throw new BadRequestException(`Acción de resolución desconocida: ${action}`);
	}
}
