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
import { PlayerRepoService } from '../../players/adapters/driven/PlayerRepo.service';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { RewardStatus, type RewardAction } from '../../rewards/app/enums';
import { FOR_DATABASE_PLAYER_CHESTS } from './constants';
import {
	ChestProgressState,
	type PlayerChestProgress,
	type UserMissionChestBasic,
} from './dto/player-chest.schema';
import type { ForManagePlayerChests } from '../ports/driven/ForManagePlayerChests';
import type { ForDatabasePlayerChests } from '../ports/driver/ForDatabasePlayerChests';

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
		@Inject(PlayerRepoService)
		private readonly playerRepo: ForDatabasePlayers,
	) {}

	async getPlayerChestsProgress(playerId: number): Promise<PlayerChestProgress[]> {
		const activeChests = await this.chestsCore.getActiveChests();
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

	async claimChest(chestId: number, playerId: number): Promise<UserMissionChestBasic> {
		const chest = await this.chestsCore.getChest(chestId);
		if (!chest.isActive) {
			throw new BadRequestException('Este cofre no se encuentra activo');
		}

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

		// 2. Adquirir bloqueo atómico en PostgreSQL creando el registro en PROCESSING
		const locked = await this.claimRepo.acquireClaimLock({
			playerId,
			chestId: chest.id,
			periodKey,
			completedMissionsCount: completedMissions,
		});

		if (!locked) {
			const existing = await this.claimRepo.findByPlayerAndPeriod(
				playerId,
				chest.id,
				periodKey,
			);
			if (existing?.status === RewardStatus.CLAIMED) {
				throw new BadRequestException('Ya has reclamado este cofre en el periodo actual');
			}
			if (existing?.status === RewardStatus.TIMEOUT_UNCERTAIN) {
				throw new BadRequestException(
					'El reclamo de este cofre se encuentra en revision por el equipo de administracion',
				);
			}
			throw new ConflictException('El cofre ya esta siendo procesado o fue reclamado');
		}

		// 3. Acreditar experiencia de inmediato en PostgreSQL (Paso local seguro)
		if (chest.experiencePoints > 0) {
			const player = await this.playerRepo.findByUnique({ id: playerId });
			if (player) {
				const newExp = (player.experience || 0) + chest.experiencePoints;
				await this.playerRepo.updatePlayerById(playerId, { experience: newExp });
			}
		}

		// Si no otorga fichas (solo exp), marcar CLAIMED directamente
		if (chest.coinsAmount <= 0) {
			return this.claimRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
				claimedAt: new Date(),
			});
		}

		// 4. Ejecutar la llamada externa hacia LuckyBet
		try {
			const mutation = await this.panelApi.creditPlayer(playerId, chest.coinsAmount);
			if (mutation.success) {
				return await this.claimRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
					externalOperationId: mutation.operationId ?? null,
					claimedAt: new Date(),
				});
			}

			this.logger.error(`Error en LuckyBet acreditando cofre: ${mutation.errorMessage}`);
			return await this.claimRepo.updateStatus(locked.id, RewardStatus.PENDING, {
				errorMessage: mutation.errorMessage ?? 'Error al acreditar saldo de cofre',
			});
		} catch (error) {
			this.logger.error(`Timeout/Fallo de red en LuckyBet para cofre claim ${locked.id}:`, error);
			return await this.claimRepo.updateStatus(locked.id, RewardStatus.TIMEOUT_UNCERTAIN, {
				errorMessage: error instanceof Error ? error.message : 'Error desconocido de conexion',
			});
		}
	}

	async getUncertainClaims(params?: {
		take?: number;
		skip?: number;
	}): Promise<{ claims: UserMissionChestBasic[]; total: number; limit: number; skip: number }> {
		const [claims, total] = await this.claimRepo.findUncertainClaims(params);
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
	): Promise<UserMissionChestBasic> {
		const claim = await this.claimRepo.findById(claimId);
		if (!claim) {
			throw new NotFoundException('Reclamo de cofre no encontrado');
		}

		if (claim.status !== RewardStatus.TIMEOUT_UNCERTAIN) {
			throw new BadRequestException('Solo se pueden resolver reclamos en estado TIMEOUT_UNCERTAIN');
		}

		const chest = await this.chestsCore.getChest(claim.chestId);

		// La experiencia ya fue otorgada en el paso previo. Solo se resuelven las fichas:
		if (action === 'RESOLVE_CLAIMED') {
			return this.claimRepo.updateStatus(claim.id, RewardStatus.CLAIMED, {
				externalOperationId: options?.externalOperationId ?? claim.externalOperationId,
				errorMessage: options?.adminNotes ? `Resuelto: ${options.adminNotes}` : undefined,
				resolvedByAdminId: adminId,
				claimedAt: new Date(),
			});
		}

		// FORCE_RETRY: Forzar la ejecución hacia LuckyBet sin tocar experiencia
		try {
			const mutation = await this.panelApi.creditPlayer(claim.playerId, chest.coinsAmount);
			if (mutation.success) {
				return await this.claimRepo.updateStatus(claim.id, RewardStatus.CLAIMED, {
					externalOperationId: mutation.operationId ?? null,
					resolvedByAdminId: adminId,
					claimedAt: new Date(),
				});
			}
			throw new BadRequestException(`Fallo el reintento en LuckyBet: ${mutation.errorMessage}`);
		} catch (error) {
			this.logger.error(`Error forzando reintento de cofre claim ${claim.id}:`, error);
			throw new BadRequestException(
				`No se pudo forzar el credito en LuckyBet: ${error instanceof Error ? error.message : 'Error de conexion'}`,
			);
		}
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
		const periodKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

		return { startDate: monday, endDate: sunday, periodKey };
	}
}
