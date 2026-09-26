import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';

import { CHESTS_CORE_PROVIDER } from '../../chests/app/constants';
import { ChestPeriodType } from '../../chests/app/enums';
import type { ForManageChests } from '../../chests/ports/driven/ForManageChests';
import { UserMissionRepoService } from '../../misiones/adapters/driven/UserMissionRepo.service';
import type { ForDatabaseUserMissions } from '../../misiones/ports/driver/ForDatabaseUserMissions';
import { FOR_PANEL_API_CORE } from '../../panelApi/constants';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import { PLAYER_CORE_PROVIDER } from '../../players/app/constants';
import type { ForManagePlayers } from '../../players/ports/driven/ForManagePlayers';
import { RewardAction, RewardStatus } from '../../rewards/app/enums';
import { FOR_DATABASE_ROOMS } from '../../rooms/app/constants';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
import type { ForManagePlayerChests } from '../ports/driven/ForManagePlayerChests';
import type { ForDatabasePlayerChests } from '../ports/driver/ForDatabasePlayerChests';
import { FOR_DATABASE_PLAYER_CHESTS } from './constants';
import {
	ChestProgressState,
	type PlayerChestFilter,
	type PlayerChestProgress,
	type PlayerChestProgressFilter,
	type UserMissionChestBasic,
} from './dto/player-chest.schema';

@Injectable()
export class PlayerChestsCore implements ForManagePlayerChests {
	private readonly logger = new Logger(PlayerChestsCore.name);

	constructor(
		@Inject(FOR_DATABASE_PLAYER_CHESTS)
		private readonly claimRepo: ForDatabasePlayerChests,
		@Inject(CHESTS_CORE_PROVIDER)
		private readonly chestsCore: ForManageChests,
		@Inject(UserMissionRepoService)
		private readonly userMissionRepo: ForDatabaseUserMissions,
		@Inject(FOR_PANEL_API_CORE)
		private readonly panelApi: ForPanelApiCore,
		@Inject(PLAYER_CORE_PROVIDER)
		private readonly playerCore: ForManagePlayers,
		@Inject(FOR_DATABASE_ROOMS)
		private readonly roomRepo: ForDatabaseRooms,
	) {}

	/**
	 * Obtiene el progreso de un cofre específico por su ID en el periodo actual.
	 */
	async getChestProgressById(
		chestId: number,
		playerId: number,
	): Promise<PlayerChestProgress> {
		const chest = await this.chestsCore.getChest(chestId);
		if (!chest.isActive) {
			throw new BadRequestException('El cofre solicitado no está activo');
		}

		const { startDate, endDate, periodKey } = this.getPeriodRange(chest.periodType);
		const completedMissions = await this.userMissionRepo.countCompletedBetween(
			playerId,
			startDate,
			endDate,
		);

		const claim = await this.claimRepo.findByPlayerAndPeriod(
			playerId,
			chest.id,
			periodKey,
		);

		let state = ChestProgressState.LOCKED;
		if (claim) {
			if (claim.status === RewardStatus.CLAIMED) {
				state = ChestProgressState.CLAIMED;
			} else if (claim.status === RewardStatus.TIMEOUT_UNCERTAIN) {
				state = ChestProgressState.TIMEOUT_UNCERTAIN;
			} else {
				state = ChestProgressState.UNLOCKED;
			}
		} else if (completedMissions >= chest.requiredMissions) {
			state = ChestProgressState.UNLOCKED;
		}

		return {
			chest,
			periodKey,
			completedMissions,
			requiredMissions: chest.requiredMissions,
			state,
			claimedAt: claim?.claimedAt,
		};
	}

	/**
	 * Formaliza la participación del usuario en el cofre del periodo actual.
	 * Si no existe, lo crea en estado PENDING con el conteo actual de misiones.
	 */
	async joinChest(chestId: number, playerId: number): Promise<UserMissionChestBasic> {
		const chest = await this.chestsCore.getChest(chestId);
		if (!chest.isActive) {
			throw new BadRequestException('Este cofre no se encuentra activo');
		}

		const { startDate, endDate, periodKey } = this.getPeriodRange(chest.periodType);

		const existing = await this.claimRepo.findByPlayerAndPeriod(
			playerId,
			chest.id,
			periodKey,
		);

		if (existing) {
			return existing;
		}

		const completedMissions = await this.userMissionRepo.countCompletedBetween(
			playerId,
			startDate,
			endDate,
		);

		const created = await this.claimRepo.acquireClaimLock({
			playerId,
			chestId: chest.id,
			periodKey,
			completedMissionsCount: completedMissions,
			coinsAmount: chest.coinsAmount,
			roomId: chest.roomId,
			status: RewardStatus.PENDING,
		});

		if (!created) {
			const found = await this.claimRepo.findByPlayerAndPeriod(
				playerId,
				chest.id,
				periodKey,
			);
			if (found) return found;
			throw new ConflictException('Error al registrar participación en el cofre');
		}

		return created;
	}

	/**
	 * Lista general filtrada de participaciones/reclamos de cofres del jugador,
	 * con soporte de ordenamiento ASC/DESC y paginación.
	 */
	async listPlayerChests(
		playerId: number,
		filter: PlayerChestFilter,
	): Promise<{
		claims: UserMissionChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [claims, total] = await this.claimRepo.getPlayerChests(filter, playerId);
		return {
			claims,
			total,
			limit: filter.take ?? 50,
			skip: filter.skip ?? 0,
		};
	}

	/**
	 * Obtiene el progreso de todos los cofres activos en el periodo actual.
	 */
	async getPlayerChestsProgress(
		playerId: number,
		filter?: PlayerChestProgressFilter,
	): Promise<PlayerChestProgress[]> {
		if (filter?.chestId) {
			const single = await this.getChestProgressById(filter.chestId, playerId);
			return [single];
		}

		const { chests: activeChests } = await this.chestsCore.listChests({
			isActive: true,
			periodType: filter?.periodType,
			skip: 0,
			take: 100,
		});
		const results: PlayerChestProgress[] = [];

		for (const chest of activeChests) {
			const { startDate, endDate, periodKey } = this.getPeriodRange(chest.periodType);
			const completedMissions = await this.userMissionRepo.countCompletedBetween(
				playerId,
				startDate,
				endDate,
			);

			const claim = await this.claimRepo.findByPlayerAndPeriod(
				playerId,
				chest.id,
				periodKey,
			);

			let state = ChestProgressState.LOCKED;
			if (claim) {
				if (claim.status === RewardStatus.CLAIMED) {
					state = ChestProgressState.CLAIMED;
				} else if (claim.status === RewardStatus.TIMEOUT_UNCERTAIN) {
					state = ChestProgressState.TIMEOUT_UNCERTAIN;
				} else {
					state = ChestProgressState.UNLOCKED;
				}
			} else if (completedMissions >= chest.requiredMissions) {
				state = ChestProgressState.UNLOCKED;
			}

			results.push({
				chest,
				periodKey,
				completedMissions,
				requiredMissions: chest.requiredMissions,
				state,
				claimedAt: claim?.claimedAt,
			});
		}

		return results;
	}

	/**
	 * Reclama la recompensa del cofre.
	 * Solo opera sobre cofres en el periodo actual que cumplan la meta mínima requerida.
	 */
	async claimChest(chestId: number, playerId: number): Promise<UserMissionChestBasic> {
		const chest = await this.chestsCore.getChest(chestId);
		if (!chest.isActive) {
			throw new BadRequestException('Este cofre no se encuentra activo');
		}

		// Obtener username y sala base actual del jugador
		const player = await this.playerCore.findById(playerId);

		if (!player) {
			throw new BadRequestException('Este jugador no existe en nuestra base de datos');
		}
		const playerIdentifier = player.username;
		const baseRoom = player.room;

		const { startDate, endDate, periodKey } = this.getPeriodRange(chest.periodType);

		// 1. Validar misiones completadas en el periodo
		const completedMissions = await this.userMissionRepo.countCompletedBetween(
			playerId,
			startDate,
			endDate,
		);

		if (completedMissions < chest.requiredMissions) {
			throw new BadRequestException(
				`Aun no cumples la meta: se requieren ${chest.requiredMissions} misiones y tienes ${completedMissions}`,
			);
		}

		// 2. Adquirir o actualizar a bloqueo atómico en PostgreSQL creando/actualizando a PROCESSING
		let locked = await this.claimRepo.findByPlayerAndPeriod(
			playerId,
			chest.id,
			periodKey,
		);

		if (locked) {
			if (locked.status === RewardStatus.CLAIMED) {
				throw new BadRequestException('Ya has reclamado este cofre en el periodo actual');
			}
			if (locked.status === RewardStatus.TIMEOUT_UNCERTAIN) {
				throw new BadRequestException(
					'El reclamo de este cofre se encuentra en revision por el equipo de administracion',
				);
			}
			if (locked.status === RewardStatus.PROCESSING) {
				throw new ConflictException('El cofre ya está siendo procesado en este momento');
			}
			locked = await this.claimRepo.updateStatus(locked.id, RewardStatus.PROCESSING, {
				completedMissionsCount: completedMissions,
			});
		} else {
			locked = await this.claimRepo.acquireClaimLock({
				playerId,
				chestId: chest.id,
				periodKey,
				completedMissionsCount: completedMissions,
				coinsAmount: chest.coinsAmount,
				roomId: chest.roomId,
				status: RewardStatus.PROCESSING,
			});
		}

		if (!locked) {
			throw new ConflictException('El cofre ya está siendo procesado o fue reclamado');
		}

		// 3. Acreditar experiencia de inmediato y recalcular nivel (sin cambio de sala permanente)
		if (chest.experiencePoints > 0 && this.playerCore) {
			await this.playerCore.addExperienceAndRecalculateLevel(
				playerId,
				chest.experiencePoints,
			);
		}

		// Si no otorga fichas (solo exp), marcar CLAIMED directamente
		if (chest.coinsAmount <= 0) {
			return this.claimRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
				claimedAt: new Date(),
			});
		}

		let transferredToTarget = false;

		// 4. Si el cofre tiene una sala con bono asignada, transferir al jugador antes de acreditar
		if (chest.roomId && this.roomRepo) {
			const targetRoom = await this.roomRepo.findById(chest.roomId);
			if (targetRoom?.isActive) {
				const success = await this.panelApi
					.changePlayerSenior(playerIdentifier, targetRoom.name)
					.catch(err => {
						this.logger.error(
							`Error al transferir jugador a sala de cofre [${targetRoom.name}]:`,
							err,
						);
						return false;
					});

				// Si falla la transferencia a la sala del cofre, abortar crédito y marcar TIMEOUT_UNCERTAIN
				if (!success) {
					return await this.claimRepo.updateStatus(
						locked.id,
						RewardStatus.TIMEOUT_UNCERTAIN,
						{
							errorMessage: `Fallo al transferir a la sala promocional del cofre [${targetRoom.name}] antes de acreditar`,
						},
					);
				}
				transferredToTarget = true;
			}
		}

		// 5. Ejecutar la llamada externa hacia LuckyBet
		let mutationResult: {
			success: boolean;
			operationId?: string | null;
			errorMessage?: string;
		} | null = null;
		try {
			mutationResult = await this.panelApi.creditPlayer(
				playerIdentifier,
				chest.coinsAmount,
			);
		} catch (error) {
			this.logger.error(
				`Timeout/Fallo de red en LuckyBet para cofre claim ${locked.id}:`,
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

			return await this.claimRepo.updateStatus(
				locked.id,
				RewardStatus.TIMEOUT_UNCERTAIN,
				{
					errorMessage:
						error instanceof Error
							? error.message
							: 'Error desconocido de conexion al acreditar cofre',
				},
			);
		}

		if (!mutationResult.success) {
			this.logger.error(
				`Error en LuckyBet acreditando cofre: ${mutationResult.errorMessage}`,
			);
			if (transferredToTarget && baseRoom) {
				await this.panelApi
					.changePlayerSenior(playerIdentifier, baseRoom.name)
					.catch(() => undefined);
			}
			return await this.claimRepo.updateStatus(locked.id, RewardStatus.PENDING, {
				errorMessage: mutationResult.errorMessage ?? 'Error al acreditar saldo de cofre',
			});
		}

		// 6. Retorno obligatorio a la sala base del jugador
		if (transferredToTarget && baseRoom) {
			const returned = await this.panelApi
				.changePlayerSenior(playerIdentifier, baseRoom.name)
				.catch(err => {
					this.logger.error(
						`Error al regresar al jugador a su sala base [${baseRoom.name}] tras cofre:`,
						err,
					);
					return false;
				});

			if (!returned) {
				return await this.claimRepo.updateStatus(
					locked.id,
					RewardStatus.TIMEOUT_UNCERTAIN,
					{
						externalOperationId: mutationResult.operationId ?? null,
						errorMessage: `Fichas de cofre acreditadas (Op: ${mutationResult.operationId}) pero fallo el retorno a la sala base [${baseRoom.name}]`,
						claimedAt: new Date(),
					},
				);
			}
		}

		return await this.claimRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
			externalOperationId: mutationResult.operationId ?? null,
			claimedAt: new Date(),
		});
	}

	async listAllChests(filter: PlayerChestFilter): Promise<{
		claims: UserMissionChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [claims, total] = await this.claimRepo.getPlayerChests(filter);
		return {
			claims,
			total,
			limit: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
		};
	}

	async resolveUncertainClaim(
		claimId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<UserMissionChestBasic> {
		const claim = await this.claimRepo.findById(claimId);
		if (!claim) {
			throw new NotFoundException(`Reclamo de cofre con ID ${claimId} no encontrado`);
		}
		if (claim.status !== RewardStatus.TIMEOUT_UNCERTAIN) {
			throw new BadRequestException(
				`Solo se pueden resolver reclamos en estado TIMEOUT_UNCERTAIN (actual: ${claim.status})`,
			);
		}

		if (action === 'RESOLVE_CLAIMED') {
			return await this.claimRepo.updateStatus(claim.id, RewardStatus.CLAIMED, {
				resolvedByAdminId: adminId,
				externalOperationId: options?.externalOperationId ?? claim.externalOperationId,
				claimedAt: new Date(),
			});
		}

		if (action === 'FORCE_RETRY') {
			return await this.claimRepo.updateStatus(claim.id, RewardStatus.PENDING, {
				resolvedByAdminId: adminId,
				errorMessage: options?.adminNotes
					? `Reintento forzado por admin ${adminId}: ${options.adminNotes}`
					: `Reintento forzado por admin ${adminId}`,
			});
		}

		throw new BadRequestException(`Acción de resolución desconocida: ${action}`);
	}

	/**
	 * Calcula el rango de fechas (startDate, endDate) y la clave única (periodKey)
	 * según el tipo de periodo (WEEKLY: Lunes a Domingo, MONTHLY: 1ro a fin de mes).
	 */
	private getPeriodRange(periodType: ChestPeriodType): {
		startDate: Date;
		endDate: Date;
		periodKey: string;
	} {
		const now = new Date();

		if (periodType === ChestPeriodType.MONTHLY) {
			const y = now.getFullYear();
			const m = now.getMonth();
			const startDate = new Date(y, m, 1, 0, 0, 0, 0);
			const nextMonthStart = new Date(y, m + 1, 1, 0, 0, 0, 0);
			const endDate = new Date(nextMonthStart.getTime() - 1);
			const monthStr = String(m + 1).padStart(2, '0');
			const periodKey = `${y}-${monthStr}`;
			return { startDate, endDate, periodKey };
		}

		// Default WEEKLY (Semana ISO: Lunes a Domingo)
		const day = now.getDay();
		const diffToMonday = day === 0 ? -6 : 1 - day;

		const monday = new Date(now);
		monday.setDate(now.getDate() + diffToMonday);
		monday.setHours(0, 0, 0, 0);

		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		sunday.setHours(23, 59, 59, 999);

		// Calcular número de semana ISO
		const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
		const weekStr = String(weekNo).padStart(2, '0');
		const periodKey = `${d.getUTCFullYear()}-W${weekStr}`;

		return { startDate: monday, endDate: sunday, periodKey };
	}
}
