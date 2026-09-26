import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, MoreThanOrEqual } from 'typeorm';

import type { ForPanelApiCore } from '@/src/panelApi/ports/forPanelApiCore.port';
import { ForManagePlayers } from '@/src/players/ports/driven/ForManagePlayers';
import type { ForManageRewards } from '@/src/rewards/ports/driven/ForManageRewards';
import { ForDatabaseUsers } from '@/src/users/ports/driver/ForDatabaseUsers';
import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import type { ForManageMissions } from '../ports/driven/ForManageMissions';
import type {
	ForManagePlayerMissions,
	PlayerMissionsQueueResult,
} from '../ports/driven/ForManagePlayerMissions';
import type { ForDatabaseMissions } from '../ports/driver/ForDatabaseMissions';
import type { ForDatabaseUserMissionSteps } from '../ports/driver/ForDatabaseUserMissionSteps';
import type { ForDatabaseUserMissions } from '../ports/driver/ForDatabaseUserMissions';
import type { CreateMissionMultipartDto } from './dto/create-mission.dto';
import type {
	MissionBasic,
	MissionFilter,
	MissionWithSteps,
	ReviewQueueByPlayer,
	StepSubmission,
	UserMissionBasic,
	UserMissionFilter,
	UserMissionWithSteps,
} from './dto/mission.schema';
import type { UpdateMissionDto } from './dto/update-mission.dto';
import type { Mission } from './entities/mission.entity';
import type { UserMission } from './entities/user-mission.entity';
import type { UserMissionStep } from './entities/user-mission-step.entity';
import {
	MissionStatus,
	MissionType,
	StepStatus,
	StepType,
	UserMissionStatus,
} from './enums';

export class MisionesCore implements ForManageMissions, ForManagePlayerMissions {
	constructor(
		private readonly missionRepo: ForDatabaseMissions,
		private readonly userMissionRepo: ForDatabaseUserMissions,
		private readonly stepRepo: ForDatabaseUserMissionSteps,
		private readonly userRepo: ForDatabaseUsers,
		private readonly storage: StorageService,
		private readonly panelApi: ForPanelApiCore,
		private readonly playerCore: ForManagePlayers,
		private readonly rewardsCore: ForManageRewards,
	) {}

	private toPublicUrl(key: string | null | undefined): string | undefined {
		return key ? this.storage.buildPublicUrl(key) : undefined;
	}

	// ─── Admin: Mission CRUD ────────────────────────────────────

	async createMission(data: CreateMissionMultipartDto): Promise<MissionWithSteps> {
    const { image, ...missionData } = data;

    for (const step of missionData.missionSteps) {
      if (step.targetConfig?.gameId && step.targetConfig.provider) {
        throw new BadRequestException("Escoge proveedor o juego pero no escojas los dos")
      }
      if (step.targetConfig?.gameId && step.targetConfig?.minUniqueGames !== undefined && step.targetConfig?.minUniqueGames > 1 ) {
       throw new BadRequestException("Si escoges un juego y un minimo de juegos unicos, entonces el minimo no puede ser mayor 1 y no puede ser 0")
      }
    }

		const imageUrl = await this.storage.uploadImage(image, 'missions');
		try {
			const mission = await this.missionRepo.createMission({
				...missionData,
				imageUrl,
			});
			mission.imageUrl = this.toPublicUrl(mission.imageUrl);
			return mission;
		} catch (error) {
			// Cleanup: avoid orphan objects in the bucket if the DB write fails
			await this.storage.deleteImage(imageUrl).catch(() => undefined);
			throw error;
		}
	}

	// ─── Admin: Mission images ──────────────────────────────────

	async replaceMissionImage(id: number, file: UploadableFile): Promise<MissionBasic> {
		const mission = await this.missionRepo.findById(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		this.validateImageFile(file);
		const newUrl = await this.storage.replaceImage(
			file,
			'missions',
			mission.imageUrl ?? '',
		);

		const updated = await this.missionRepo.updateMission(id, {
			imageUrl: newUrl,
		});
		if (!updated) throw new NotFoundException('Mision no encontrada');
		updated.imageUrl = this.toPublicUrl(updated.imageUrl);
		return updated;
	}

	async deleteMissionImage(id: number): Promise<MissionBasic> {
		const mission = await this.missionRepo.findById(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		if (mission.imageUrl) {
			await this.storage.deleteImage(mission.imageUrl);
		}

		const updated = await this.missionRepo.updateMission(id, {
			imageUrl: null,
		});
		if (!updated) throw new NotFoundException('Mision no encontrada');
		updated.imageUrl = this.toPublicUrl(updated.imageUrl);
		return updated;
	}

	private validateImageFile(file: UploadableFile): void {
		if (!file.filename.trim()) {
			throw new BadRequestException('El archivo debe tener un nombre');
		}
		if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
			throw new BadRequestException('Solo se permiten imagenes JPEG o PNG');
		}
		if (file.buffer.length > 5 * 1024 * 1024) {
			throw new BadRequestException('La imagen no puede superar los 5 MiB');
		}
	}

	async getMission(id: number): Promise<MissionWithSteps> {
		const mission = await this.missionRepo.findByIdWithSteps(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');
		mission.imageUrl = this.toPublicUrl(mission.imageUrl);
		return mission;
	}

	async listMissions(filter?: MissionFilter): Promise<{
		missions: MissionWithSteps[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [missions, total] = await this.missionRepo.getMissions(filter);
		return {
			missions: missions.map(m => ({
				...m,
				imageUrl: this.toPublicUrl(m.imageUrl),
			})),
			total,
			limit: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
		};
	}

	async updateMission(id: number, data: UpdateMissionDto): Promise<MissionBasic> {
		const mission = await this.missionRepo.findById(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		// Immutability rule: active missions content cannot change
		if (mission.status === MissionStatus.ACTIVE) {
			throw new BadRequestException(
				'El contenido de la mision es inmutable despues de activarse',
			);
		}

		const updated = await this.missionRepo.updateMission(id, data);
		if (!updated) throw new NotFoundException('Mision no encontrada');
		updated.imageUrl = this.toPublicUrl(updated.imageUrl);
		return updated;
	}

	async activateMission(id: number): Promise<MissionBasic> {
		const mission = await this.missionRepo.findById(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		if (mission.status !== MissionStatus.INACTIVE) {
			throw new BadRequestException('Solo se pueden activar misiones en estado INACTIVE');
		}

		// Row lock handled in repo layer via pessimistic_write
		const activated = await this.missionRepo.activateMission(id);
		activated.imageUrl = this.toPublicUrl(activated.imageUrl);
		return activated;
	}

	async changeMissionStatus(id: number, status: MissionStatus): Promise<MissionBasic> {
		const mission = await this.missionRepo.findById(id);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		const validTransitions: Record<string, MissionStatus[]> = {
			[MissionStatus.INACTIVE]: [MissionStatus.ACTIVE, MissionStatus.CANCELLED],
			[MissionStatus.ACTIVE]: [MissionStatus.COMPLETED, MissionStatus.CANCELLED],
		};

		const allowed = validTransitions[mission.status];
		if (!allowed.includes(status)) {
			throw new BadRequestException(
				`Transicion de ${mission.status} a ${status} no valida`,
			);
		}

		if (status === MissionStatus.ACTIVE && mission.status === MissionStatus.INACTIVE) {
			return this.activateMission(id);
		}

		const updated = await this.missionRepo.updateMission(id, { status });
		if (!updated) throw new NotFoundException('Mision no encontrada');
		updated.imageUrl = this.toPublicUrl(updated.imageUrl);
		return updated;
	}

	// ─── Player: Mission Progress ───────────────────────────────

	async startMission(playerId: number, missionId: number): Promise<UserMissionBasic> {
		const mission = await this.missionRepo.findById(missionId);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		if (mission.status !== MissionStatus.ACTIVE) {
			throw new BadRequestException('La mision no esta activa');
		}

		if (mission.expiresAt && new Date() > mission.expiresAt) {
			throw new BadRequestException('La mision ha expirado');
		}

		const existing = await this.userMissionRepo.findByPlayerAndMission(
			playerId,
			missionId,
		);
		if (existing) {
			throw new BadRequestException('Ya tienes esta mision en progreso o completada');
		}

		return this.userMissionRepo.createUserMission({ playerId, missionId });
	}

	async submitStep(
		userMissionId: number,
		stepId: number,
		data: { submissionText?: string; submissionImage?: UploadableFile },
		playerId?: number,
	): Promise<StepSubmission> {
		const um = await this.userMissionRepo.findByIdWithSteps(userMissionId);
		if (!um) throw new NotFoundException('Mision de usuario no encontrada');

		if (playerId !== undefined && um.playerId !== playerId) {
			throw new ForbiddenException('No tienes permiso para modificar esta mision');
		}

		if (um.status !== UserMissionStatus.IN_PROGRESS) {
			throw new BadRequestException('La mision de usuario no esta en progreso');
		}

		const mission = await this.missionRepo.findByIdWithSteps(um.missionId);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		const stepDef = mission.steps.find(s => s.id === stepId);
		if (!stepDef) throw new NotFoundException('Paso no encontrado en la mision');

		// Validate step order
		if (stepDef.stepOrder !== um.currentStep) {
			throw new BadRequestException(`Debes completar el paso ${um.currentStep} primero`);
		}

		if (stepDef.type === StepType.GAME_PLAY) {
			throw new BadRequestException(
				'Este paso es de verificacion automatica (GAME_PLAY). Usa el endpoint de verificacion',
			);
		}

		let submissionText: string | undefined;
		let submissionImageUrl: string | undefined;

		// Validate and upload content by type
		if (stepDef.type === StepType.IMAGE) {
			if (!data.submissionImage) {
				throw new BadRequestException('El paso de tipo IMAGE requiere una imagen');
			}
			submissionImageUrl = await this.storage.uploadImage(data.submissionImage, 'steps');
		} else {
			if (!data.submissionText) {
				throw new BadRequestException('El paso de tipo TEXT requiere texto');
			}
			if (data.submissionImage) {
				throw new BadRequestException('Este paso no requiere imagen');
			}
			submissionText = data.submissionText;
		}

		return this.stepRepo
			.createOrUpdateSubmission({
				userMissionId,
				missionStepId: stepId,
				submissionText,
				submissionImageUrl,
			})
			.then(submission => ({
				...submission,
				submissionImageUrl: this.toPublicUrl(submission.submissionImageUrl),
			}));
	}

	async verifyAutoStep(
		userMissionId: number,
		stepId: number,
		playerId: number,
		token?: string,
	): Promise<StepSubmission> {
		const um = await this.userMissionRepo.findByIdWithSteps(userMissionId);
		if (!um) throw new NotFoundException('Mision de usuario no encontrada');

		if (um.playerId !== playerId) {
			throw new ForbiddenException('No tienes permiso para modificar esta mision');
		}

		if (um.status !== UserMissionStatus.IN_PROGRESS) {
			throw new BadRequestException('La mision de usuario no esta en progreso');
		}

		const mission = await this.missionRepo.findByIdWithSteps(um.missionId);
		if (!mission) throw new NotFoundException('Mision no encontrada');

		const stepDef = mission.steps.find(s => s.id === stepId);
		if (!stepDef) throw new NotFoundException('Paso no encontrado en la mision');

		if (stepDef.stepOrder !== um.currentStep) {
			throw new BadRequestException(`Debes completar el paso ${um.currentStep} primero`);
		}

		if (stepDef.type !== StepType.GAME_PLAY) {
			throw new BadRequestException(
				'Solo los pasos de tipo GAME_PLAY pueden verificarse automaticamente',
			);
		}

		const targetConfig = stepDef.targetConfig;
		const history = await this.panelApi.getLastPlayedGames(playerId, {
			provider: targetConfig?.provider,
			gameName: targetConfig?.gameId,
			token,
		});

		const minUniqueGames = targetConfig?.gameId ? 1 : targetConfig?.minUniqueGames ?? 1;

		if (history.totalUniqueGames < minUniqueGames) {
			throw new BadRequestException(
				`Aun no cumples el requisito: se requieren ${minUniqueGames} juego(s) y tienes ${history.totalUniqueGames}`,
			);
		}

		// Mark step approved by system
		const submission = await this.stepRepo.createOrUpdateSubmission({
			userMissionId,
			missionStepId: stepId,
			submissionText: 'Verificado automaticamente por sistema',
		});

		await this.stepRepo.reviewStep(
			submission.id,
			StepStatus.APPROVED,
			0,
			'Aprobado automaticamente por juego en LuckyBet',
		);

		// Advance user mission or complete
		const totalSteps = mission.steps.length;
		if (um.currentStep >= totalSteps) {
			await this.completeUserMission(um.id, mission, playerId);
		} else {
			await this.userMissionRepo.updateCurrentStep(um.id, um.currentStep + 1);
		}

		return {
			...submission,
			status: StepStatus.APPROVED,
			reviewedById: 0,
			reviewedAt: new Date(),
			reviewerNotes: 'Aprobado automaticamente por juego en LuckyBet',
		};
	}

	async reviewStep(
		stepId: number,
		status: StepStatus.APPROVED | StepStatus.REJECTED,
		adminId: number,
		notes?: string,
	): Promise<StepSubmission> {
		if (adminId !== 0) {
			const admin = await this.userRepo.findByUnique({ id: adminId });
			if (!admin) throw new BadRequestException('Usuario administrador no encontrado');
			if (!admin.isActive)
				throw new BadRequestException('Usuario administrador no activo');
		}

		const submission = await this.stepRepo.reviewStep(stepId, status, adminId, notes);

		// If approved, advance the user mission
		if (status === StepStatus.APPROVED) {
			const um = await this.userMissionRepo.findById(submission.userMissionId);
			if (!um) throw new NotFoundException('Mision de usuario no encontrada');

			const mission = await this.missionRepo.findByIdWithSteps(um.missionId);
			if (!mission) throw new NotFoundException('Mision no encontrada');

			const totalSteps = mission.steps.length;
			if (um.currentStep >= totalSteps) {
				await this.completeUserMission(um.id, mission, um.playerId);
			} else {
				await this.userMissionRepo.updateCurrentStep(um.id, um.currentStep + 1);
			}
		}

		return {
			...submission,
			submissionImageUrl: this.toPublicUrl(submission.submissionImageUrl),
		};
	}

	private async completeUserMission(
		userMissionId: number,
		mission: MissionWithSteps,
		playerId: number,
	): Promise<void> {
		// 1. Marcar UserMission como COMPLETED
		await this.userMissionRepo.updateStatus(userMissionId, UserMissionStatus.COMPLETED);

		// 2. Acreditar experiencia de forma inmediata y recalcular nivel con actualizacion de sala en LuckyBet
		if (mission.experiencePoints > 0) {
			await this.playerCore.addExperienceAndRecalculateLevel(
				playerId,
				mission.experiencePoints,
			);
		}

		// 3. Crear registro en el Ledger de Recompensas (RewardsCore) transfiriendo el bono correspondiente

		await this.rewardsCore.createReward({
			userMissionId,
			playerId,
			coinsAmount: mission.coinsAmount,
			roomId: mission.roomId,
			experiencePoints: mission.experiencePoints,
		});
	}

	async getPlayerMissions(
		playerId: number,
		filter?: UserMissionFilter,
	): Promise<{
		missions: UserMissionBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [missions, total] = await this.userMissionRepo.findByPlayer(playerId, filter);
		return {
			missions,
			total,
			limit: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
		};
	}

	async getPlayerMission(id: number, playerId?: number): Promise<UserMissionWithSteps> {
		const um = await this.userMissionRepo.findByIdWithSteps(id);
		if (!um) throw new NotFoundException('Mision de usuario no encontrada');

		if (playerId !== undefined && um.playerId !== playerId) {
			throw new ForbiddenException('No tienes permiso para ver esta mision');
		}

		um.steps = um.steps.map(step => ({
			...step,
			submissionImageUrl: this.toPublicUrl(step.submissionImageUrl),
		}));
		return um;
	}

	async getPlayerMissionsQueue(filters: {
		status?: string;
		playerId?: number;
		experience?: number;
		coinsAmount?: number;
		type?: string;
		take?: number;
		skip?: number;
	}): Promise<PlayerMissionsQueueResult> {
		const take = filters.take ?? 100;
		const skip = filters.skip ?? 0;

		const { stepStatus, umStatus } = this.resolveQueueStatus(filters.status);

		// Single repository find over the whole matching set; grouping and
		// pagination by distinct players happen in memory in core.
		const userMissions = await this.userMissionRepo.findUserMissionsWithContext(
			this.buildUserMissionQueueWhere({
				umStatus,
				playerId: filters.playerId,
				experience: filters.experience,
				coinsAmount: filters.coinsAmount,
				type: this.resolveMissionType(filters.type),
			}),
		);

		const players = this.groupUserMissionsByPlayer(userMissions, stepStatus);
		const page = players.slice(skip, skip + take);

		return { players: page, total: players.length, limit: take, skip };
	}

	// ─── Review queue helpers ────────────────────────────────────

	/**
	 * Resolves the `status` filter into an exclusive step-level or
	 * mission-level condition. Valid StepStatus values filter the step
	 * submission; valid UserMissionStatus values filter the user mission.
	 * Default (undefined/invalid) is StepStatus.PENDING.
	 */
	private resolveQueueStatus(status?: string): {
		stepStatus?: StepStatus;
		umStatus?: UserMissionStatus;
	} {
		if (status === undefined || status === null) {
			return { stepStatus: StepStatus.PENDING };
		}
		if (Object.values(StepStatus).includes(status as StepStatus)) {
			return { stepStatus: status as StepStatus };
		}
		if (Object.values(UserMissionStatus).includes(status as UserMissionStatus)) {
			return { umStatus: status as UserMissionStatus };
		}
		return { stepStatus: StepStatus.PENDING };
	}

	private resolveMissionType(type?: string): MissionType | undefined {
		if (type === undefined || type === null) return;
		return Object.values(MissionType).includes(type as MissionType)
			? (type as MissionType)
			: undefined;
	}

	private buildUserMissionQueueWhere(params: {
		umStatus?: UserMissionStatus;
		playerId?: number;
		experience?: number;
		coinsAmount?: number;
		type?: MissionType;
	}): FindOptionsWhere<UserMission> {
		const where: FindOptionsWhere<UserMission> = {};
		if (params.playerId !== undefined) {
			where.playerId = params.playerId;
		}
		if (params.umStatus) {
			where.status = params.umStatus;
		}

		const missionWhere: FindOptionsWhere<Mission> = {};
		if (params.experience !== undefined) {
			missionWhere.experiencePoints = MoreThanOrEqual(params.experience);
		}
		if (params.coinsAmount !== undefined) {
			missionWhere.coinsAmount = params.coinsAmount;
		}
		if (params.type) {
			missionWhere.type = params.type;
		}
		if (Object.keys(missionWhere).length > 0) {
			where.mission = missionWhere;
		}
		return where;
	}

	private groupUserMissionsByPlayer(
		userMissions: UserMission[],
		stepStatus?: StepStatus,
	): ReviewQueueByPlayer[] {
		const byPlayer = new Map<
			number,
			{
				playerId: number;
				playerName?: string;
				missions: Map<
					number,
					{
						userMissionId: number;
						missionId: number;
						missionTitle: string;
						missionDescription?: string;
						missionType: string;
						coinsAmount: number;
						experiencePoints: number;
						userMissionStatus: string;
						imageUrl?: string;
						steps: UserMissionStep[];
					}
				>;
			}
		>();

		for (const um of userMissions) {
			const steps = (um.steps ?? []).filter(s =>
				stepStatus !== undefined ? s.status === stepStatus : true,
			);

			if (steps.length === 0) continue;

			const playerId = um.playerId;

			let playerEntry = byPlayer.get(playerId);
			if (!playerEntry) {
				playerEntry = {
					playerId,
					playerName: um.player?.username,
					missions: new Map(),
				};
				byPlayer.set(playerId, playerEntry);
			}

			playerEntry.missions.set(um.id, {
				userMissionId: um.id,
				missionId: um.missionId,
				missionTitle: um.mission?.title ?? '',
				missionDescription: um.mission?.description,
				missionType: um.mission?.type ?? '',
				coinsAmount: um.mission?.coinsAmount ?? 0,
				experiencePoints: um.mission?.experiencePoints ?? 0,
				userMissionStatus: um.status,
				imageUrl: this.toPublicUrl(um.mission?.imageUrl),
				steps: steps.map(step => this.toQueueStepSubmission(step)),
			});
		}

		return Array.from(byPlayer.values()).map(player => ({
			playerId: player.playerId,
			playerName: player.playerName,
			missions: Array.from(player.missions.values()).map(mission => ({
				...mission,
				steps: mission.steps.map(s => ({
					id: s.id,
					userMissionId: s.userMissionId,
					missionStepId: s.missionStepId,
					status: s.status,
					submissionText: s.submissionText,
					submissionImageUrl: this.toPublicUrl(s.submissionImageUrl),
					reviewedById: s.reviewedById,
					reviewedAt: s.reviewedAt,
					reviewerNotes: s.reviewerNotes,
				})),
			})),
		}));
	}

	private toQueueStepSubmission(step: UserMissionStep): UserMissionStep {
		return {
			...step,
			submissionImageUrl: this.toPublicUrl(step.submissionImageUrl),
		};
	}
}
