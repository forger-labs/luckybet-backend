import {
	BadRequestException,
	ForbiddenException,
	Logger,
	NotFoundException,
} from '@nestjs/common';

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
	ReviewQueueItem,
	StepSubmission,
	UserMissionBasic,
	UserMissionFilter,
	UserMissionWithSteps,
} from './dto/mission.schema';
import type { UpdateMissionDto } from './dto/update-mission.dto';
import type { UserMission } from './entities/user-mission.entity';
import { MissionStatus, StepStatus, StepType, UserMissionStatus } from './enums';

export class MisionesCore implements ForManageMissions, ForManagePlayerMissions {
	private readonly logger = new Logger(MisionesCore.name);

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
				throw new BadRequestException('Escoge proveedor o juego pero no escojas los dos');
			}
			if (
				step.targetConfig?.gameId &&
				step.targetConfig?.minUniqueGames !== undefined &&
				step.targetConfig?.minUniqueGames > 1
			) {
				throw new BadRequestException(
					'Si escoges un juego y un minimo de juegos unicos, entonces el minimo no puede ser mayor 1 y no puede ser 0',
				);
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

		if (mission.expiresAt && mission.expiresAt.getTime() <= Date.now()) {
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

		if (mission.expiresAt && mission.expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException('La mision ya expiro');
		}

		const stepDef = mission.steps.find(s => s.id === stepId);
		if (!stepDef) throw new NotFoundException('Paso no encontrado en la mision');

		if (stepDef.type === StepType.GAME_PLAY) {
			throw new BadRequestException(
				'Este paso es de verificacion automatica (GAME_PLAY). Usa el endpoint de verificacion',
			);
		}

		// Validate if the step has already been approved
		const existingStep = um.steps?.find(s => s.missionStepId === stepId);
		if (existingStep?.status === StepStatus.APPROVED) {
			throw new BadRequestException(
				'Este paso ya ha sido aprobado y no puede modificarse',
			);
		}

		if (existingStep?.status === StepStatus.PENDING) {
			throw new BadRequestException(
				'Este paso está pendiente por revision y no puede modificarse',
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

			// Delete previous image if exists
			if (existingStep?.submissionImageUrl) {
				try {
					await this.storage.deleteImage(existingStep.submissionImageUrl);
				} catch (error) {
					this.logger.warn(
						`No se pudo eliminar la imagen previa del paso: ${existingStep.submissionImageUrl}`,
						error,
					);
				}
			}
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
		username: string,
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

		if (mission.expiresAt && mission.expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException('La mision ya expiro');
		}

		const stepDef = mission.steps.find(s => s.id === stepId);
		if (!stepDef) throw new NotFoundException('Paso no encontrado en la mision');

		if (stepDef.type !== StepType.GAME_PLAY) {
			throw new BadRequestException(
				'Solo los pasos de tipo GAME_PLAY pueden verificarse automaticamente',
			);
		}

		const existingStep = um.steps?.find(s => s.missionStepId === stepId);
		if (existingStep?.status === StepStatus.APPROVED) {
			throw new BadRequestException('Este paso ya ha sido verificado y aprobado');
		}

		const now = Date.now();
		const startedAt = um.startedAt ? new Date(um.startedAt).getTime() : now;
		const days = Math.max(1, Math.ceil((now - startedAt) / (1000 * 60 * 60 * 24)));

		const targetConfig = stepDef.targetConfig;
		const history = await this.panelApi.getLastPlayedGames(username, {
			provider: targetConfig?.provider,
			gameName: targetConfig?.gameId,
			days,
			token,
			ttl: 10,
			forceRefresh: true,
		});

		const requiredUniqueGames = targetConfig?.gameId
			? 1
			: (targetConfig?.minUniqueGames ?? 1);
		const minBet = targetConfig?.minBet ?? 0;

		// Cada juego en history.games debe cumplir con la apuesta mínima requerida (totalBetInPeriod >= minBet)
		const qualifyingGames = (history.games || []).filter(
			g => (g.totalBetInPeriod ?? 0) >= minBet,
		);

		if (qualifyingGames.length < requiredUniqueGames) {
			throw new BadRequestException(
				`Aun no cumples el requisito: se requieren ${requiredUniqueGames} juego(s) con apuesta mínima de ${minBet} y tienes ${qualifyingGames.length}`,
			);
		}

		// Mark step approved by system

		let submission = await this.stepRepo.findByUserMissionAndStep(userMissionId, stepId);

		if (!submission) {
			submission = await this.stepRepo.createOrUpdateSubmission({
				userMissionId,
				missionStepId: stepId,
				submissionText: 'Verificado automaticamente por juego en LuckyBet',
			});
		}

		if (submission.status === StepStatus.APPROVED) {
			throw new BadRequestException('El paso ya fue aprobado');
		}

		await this.stepRepo.reviewStep(
			submission.id,
			StepStatus.APPROVED,
			0,
			'Aprobado automaticamente por juego en LuckyBet',
		);

		// Advance user mission approved steps count and complete if all done
		const totalSteps = mission.steps.length;
		const newCurrentStep = um.currentStep + 1;
		await this.userMissionRepo.updateCurrentStep(um.id, newCurrentStep);

		if (newCurrentStep >= totalSteps) {
			await this.completeUserMission(um.id, mission, playerId);
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

		const previousStep = await this.stepRepo.findById(stepId);
		if (!previousStep) throw new NotFoundException('Paso de usuario no encontrado');

		const wasAlreadyApproved = previousStep.status === StepStatus.APPROVED;

		const submission = await this.stepRepo.reviewStep(stepId, status, adminId, notes);

		const um = await this.userMissionRepo.findById(submission.userMissionId);
		if (!um) throw new NotFoundException('Mision de usuario no encontrada');

		const mission = await this.missionRepo.findByIdWithSteps(um.missionId);
		if (!mission) throw new NotFoundException('Mision no encontrada');
		const totalSteps = mission.steps.length;

		const mStep = mission.steps.find(mStep => mStep.id === submission.missionStepId);

		if (!mStep) {
			throw new NotFoundException('Paso de usuario no coincide con los registros');
		}

		if (mStep.type === StepType.GAME_PLAY) {
			throw new BadRequestException('El paso de juegos se verifica automaticamente');
		}

		// If transitioning to APPROVED and was not already approved, advance user mission
		if (status === StepStatus.APPROVED && !wasAlreadyApproved) {
			const newCurrentStep = um.currentStep + 1;
			await this.userMissionRepo.updateCurrentStep(um.id, newCurrentStep);

			if (newCurrentStep >= totalSteps) {
				await this.completeUserMission(um.id, mission, um.playerId);
			}
		} else if (status === StepStatus.REJECTED && wasAlreadyApproved) {
			const newCurrentStep = um.currentStep - 1;
			await this.userMissionRepo.updateCurrentStep(um.id, newCurrentStep);
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

		// 3. Crear registro en el Ledger de Recompensas (RewardsCore)
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
		missions: UserMissionWithSteps[];
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
		status?: UserMissionStatus;
		playerId?: number;
		minExperience?: number;
		maxExperience?: number;
		minCoinsAmount?: number;
		maxCoinsAmount?: number;
		type?: string;
		take?: number;
		skip?: number;
	}): Promise<PlayerMissionsQueueResult> {
		const take = filters.take ?? 100;
		const skip = filters.skip ?? 0;

		const [userMissions, total] = await this.userMissionRepo.findUserMissionsWithContext(
			{
				umStatus: filters.status,
				playerId: filters.playerId,
				minExperience: filters.minExperience,
				maxExperience: filters.maxExperience,
				minCoinsAmount: filters.minCoinsAmount,
				maxCoinsAmount: filters.maxCoinsAmount,
				type: filters.type,
			},
			take,
			skip,
		);

		const items: ReviewQueueItem[] = userMissions.map(um => ({
			userMissionId: um.id,
			playerId: um.playerId,
			playerName: um.player?.username,
			missionId: um.missionId,
			missionTitle: um.mission?.title ?? '',
			missionDescription: um.mission?.description,
			missionType: um.mission?.type ?? '',
			coinsAmount: um.mission?.coinsAmount ?? 0,
			experiencePoints: um.mission?.experiencePoints ?? 0,
			userMissionStatus: um.status,
			imageUrl: this.toPublicUrl(um.mission?.imageUrl),
			steps: (um.steps ?? []).map(s => ({
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
		}));

		return { items, total, limit: take, skip };
	}
}
