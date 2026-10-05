import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForManagePlayers } from '../../players/ports/driven/ForManagePlayers';
import type { ForManageRewards } from '../../rewards/ports/driven/ForManageRewards';
import type { ForDatabaseUsers } from '../../users/ports/driver/ForDatabaseUsers';
import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import type { ForDatabaseMissions } from '../ports/driver/ForDatabaseMissions';
import type { ForDatabaseUserMissionSteps } from '../ports/driver/ForDatabaseUserMissionSteps';
import type { ForDatabaseUserMissions } from '../ports/driver/ForDatabaseUserMissions';
import { MissionStatus, MissionType, StepStatus, StepType, UserMissionStatus } from './enums';
import { MisionesCore } from './misionesCore';
import { UserWithoutPassword } from '@/src/users/app/dto/user.schema';

describe('MisionesCore - submitStep and step progress', () => {
	let core: MisionesCore;
	let mockMissionRepo: jest.Mocked<ForDatabaseMissions>;
	let mockUserMissionRepo: jest.Mocked<ForDatabaseUserMissions>;
	let mockStepRepo: jest.Mocked<ForDatabaseUserMissionSteps>;
	let mockUserRepo: jest.Mocked<ForDatabaseUsers>;
	let mockStorage: jest.Mocked<StorageService>;
	let mockPanelApi: jest.Mocked<ForPanelApiCore>;
	let mockPlayerCore: jest.Mocked<ForManagePlayers>;
	let mockRewardsCore: jest.Mocked<ForManageRewards>;

	const mockImageFile: UploadableFile = {
		buffer: Buffer.from('image-bytes'),
		filename: 'receipt.png',
		mimetype: 'image/png',
	};

	const mockMission = {
		id: 1,
		title: 'Mision de prueba',
		description: 'Descripcion',
		type: MissionType.DAILY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 100,
		roomId: null,
		experiencePoints: 50,
		steps: [
			{ id: 10, missionId: 1, stepOrder: 1, type: StepType.IMAGE, content: 'Subir captura' },
			{ id: 20, missionId: 1, stepOrder: 2, type: StepType.TEXT, content: 'Escribir feedback' },
			{
				id: 30,
				missionId: 1,
				stepOrder: 3,
				type: StepType.GAME_PLAY,
				content: 'Jugar partidas',
				targetConfig: { provider: 'Pragmatic', minUniqueGames: 2, minBet: 10 },
			},
		],
	};

	const mockUserMission = {
		id: 100,
		playerId: 5,
		missionId: 1,
		status: UserMissionStatus.IN_PROGRESS,
		currentStep: 0,
		startedAt: new Date(),
		steps: [],
	};

	beforeEach(() => {
		mockMissionRepo = {
			createMission: jest.fn(),
			findById: jest.fn(),
			findByIdWithSteps: jest.fn(),
			updateMission: jest.fn(),
			activateMission: jest.fn(),
			findActiveMissions: jest.fn(),
			getMissions: jest.fn(),
		};

		mockUserMissionRepo = {
			createUserMission: jest.fn(),
			findById: jest.fn(),
			findByPlayerAndMission: jest.fn(),
			findByPlayer: jest.fn(),
			findByIdWithSteps: jest.fn(),
			findUserMissionsWithContext: jest.fn(),
			updateCurrentStep: jest.fn(),
			updateStatus: jest.fn(),
			countCompletedBetween: jest.fn(),
		};

		mockStepRepo = {
			createOrUpdateSubmission: jest.fn(),
			findById: jest.fn(),
			findByUserMissionAndStep: jest.fn(),
			findByUserMission: jest.fn(),
			reviewStep: jest.fn(),
		};

		mockUserRepo = {
			createUser: jest.fn(),
			findByUnique: jest.fn(),
			getUsers: jest.fn(),
			updateUserById: jest.fn(),
			findToAuth: jest.fn(),
		};

		mockStorage = {
			uploadImage: jest.fn(),
			replaceImage: jest.fn(),
			deleteImage: jest.fn(),
			buildPublicUrl: jest.fn((key: string) => `https://cdn.luckybet.com/${key}`),
		};

		mockPanelApi = {
			authenticatePlayer: jest.fn(),
			syncOrRegisterPlayer: jest.fn(),
			invalidatePlayerSession: jest.fn(),
			hashToken: jest.fn(),
			creditPlayer: jest.fn(),
			debitPlayer: jest.fn(),
			getLastPlayedGames: jest.fn(),
			getLastPlayedGame: jest.fn(),
			changePlayerSenior: jest.fn(),
			getGameList: jest.fn(),
			getProviders: jest.fn(),
		};

		mockPlayerCore = {
			createPlayer: jest.fn(),
			findById: jest.fn(),
			getPlayers: jest.fn(),
			updatePlayerById: jest.fn(),
			addExperienceAndRecalculateLevel: jest.fn(),
			getLastPlayedGame: jest.fn(),
			getPlayedGames: jest.fn(),
		};

		mockRewardsCore = {
			createReward: jest.fn(),
			claimReward: jest.fn(),
      listPlayerRewards: jest.fn(),
      findClaimRewardByUMId: jest.fn(),
			listAllRewards: jest.fn(),
			resolveUncertainReward: jest.fn(),
		};

		core = new MisionesCore(
			mockMissionRepo,
			mockUserMissionRepo,
			mockStepRepo,
			mockUserRepo,
			mockStorage,
			mockPanelApi,
			mockPlayerCore,
			mockRewardsCore,
		);
	});

	describe('submitStep', () => {
		it('debería rechazar si la misión de usuario no existe', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue(null);

			await expect(
				core.submitStep(100, 10, { submissionImage: mockImageFile }, 5),
			).rejects.toThrow(NotFoundException);
		});

		it('debería rechazar si el usuario no es el dueño', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue({
				...mockUserMission,
				playerId: 999,
			});

			await expect(
				core.submitStep(100, 10, { submissionImage: mockImageFile }, 5),
			).rejects.toThrow(ForbiddenException);
		});

		it('debería rechazar si la misión no está IN_PROGRESS', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue({
				...mockUserMission,
				status: UserMissionStatus.COMPLETED,
			});

			await expect(
				core.submitStep(100, 10, { submissionImage: mockImageFile }, 5),
			).rejects.toThrow(BadRequestException);
		});

		it('debería rechazar si el paso es GAME_PLAY', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue(mockUserMission);
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);

			await expect(
				core.submitStep(100, 30, { submissionText: 'intento' }, 5),
			).rejects.toThrow('Este paso es de verificacion automatica');
		});

		it('debería rechazar si el paso ya fue aprobado (APPROVED)', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue({
				...mockUserMission,
				steps: [
					{
						id: 1,
						userMissionId: 100,
						missionStepId: 10,
						status: StepStatus.APPROVED,
					},
				],
			});
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);

			await expect(
				core.submitStep(100, 10, { submissionImage: mockImageFile }, 5),
			).rejects.toThrow('Este paso ya ha sido aprobado y no puede modificarse');
		});

		it('debería subir imagen y guardar sumisión para paso tipo IMAGE', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue(mockUserMission);
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);
			mockStorage.uploadImage.mockResolvedValue('steps/new-uuid-image.png');
			mockStepRepo.createOrUpdateSubmission.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.PENDING,
				submissionImageUrl: 'steps/new-uuid-image.png',
			});

			const result = await core.submitStep(100, 10, { submissionImage: mockImageFile }, 5);

			expect(mockStorage.uploadImage).toHaveBeenCalledWith(mockImageFile, 'steps');
			expect(mockStepRepo.createOrUpdateSubmission).toHaveBeenCalledWith({
				userMissionId: 100,
				missionStepId: 10,
				submissionText: undefined,
				submissionImageUrl: 'steps/new-uuid-image.png',
			});
			expect(result.submissionImageUrl).toBe('https://cdn.luckybet.com/steps/new-uuid-image.png');
		});

		it('debería eliminar la imagen previa si se reenvía una nueva imagen en estado PENDING o REJECTED', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue({
				...mockUserMission,
				steps: [
					{
						id: 1,
						userMissionId: 100,
						missionStepId: 10,
						status: StepStatus.REJECTED,
						submissionImageUrl: 'steps/old-uuid-image.png',
					},
				],
			});
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);
			mockStorage.uploadImage.mockResolvedValue('steps/new-uuid-image.png');
			mockStepRepo.createOrUpdateSubmission.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.PENDING,
				submissionImageUrl: 'steps/new-uuid-image.png',
			});

			await core.submitStep(100, 10, { submissionImage: mockImageFile }, 5);

			expect(mockStorage.uploadImage).toHaveBeenCalledWith(mockImageFile, 'steps');
			expect(mockStorage.deleteImage).toHaveBeenCalledWith('steps/old-uuid-image.png');
		});

		it('debería permitir enviar un paso TEXT en cualquier orden sin requerir que los pasos anteriores estén aprobados', async () => {
			mockUserMissionRepo.findByIdWithSteps.mockResolvedValue({
				...mockUserMission,
				currentStep: 0, // El paso 1 (IMAGE) aún no está aprobado
			});
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);
			mockStepRepo.createOrUpdateSubmission.mockResolvedValue({
				id: 2,
				userMissionId: 100,
				missionStepId: 20,
				status: StepStatus.PENDING,
				submissionText: 'Excelente plataforma',
			});

			const result = await core.submitStep(100, 20, { submissionText: 'Excelente plataforma' }, 5);

			expect(mockStepRepo.createOrUpdateSubmission).toHaveBeenCalledWith({
				userMissionId: 100,
				missionStepId: 20,
				submissionText: 'Excelente plataforma',
				submissionImageUrl: undefined,
			});
			expect(result.status).toBe(StepStatus.PENDING);
		});
	});

	describe('reviewStep & currentStep counting', () => {
		it('debería incrementar currentStep al aprobar un paso y completar misión si todos están aprobados', async () => {
			mockUserRepo.findByUnique.mockResolvedValue({ id: 99, isActive: true } as unknown as UserWithoutPassword);
			mockStepRepo.findById.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.PENDING,
			});
			mockStepRepo.reviewStep.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.APPROVED,
				reviewedById: 99,
				reviewedAt: new Date(),
			});
			mockUserMissionRepo.findById.mockResolvedValue({
				...mockUserMission,
				currentStep: 2, // Ya habían 2 pasos aprobados de 3
			});
			mockMissionRepo.findByIdWithSteps.mockResolvedValue(mockMission);

			await core.reviewStep(1, StepStatus.APPROVED, 99, 'Todo correcto');

			expect(mockUserMissionRepo.updateCurrentStep).toHaveBeenCalledWith(100, 3);
			expect(mockUserMissionRepo.updateStatus).toHaveBeenCalledWith(100, UserMissionStatus.COMPLETED);
			expect(mockPlayerCore.addExperienceAndRecalculateLevel).toHaveBeenCalledWith(5, 50);
			expect(mockRewardsCore.createReward).toHaveBeenCalledWith({
				userMissionId: 100,
				playerId: 5,
				coinsAmount: 100,
				roomId: null,
				experiencePoints: 50,
			});
		});

		it('no debería duplicar el incremento de currentStep si el paso ya estaba APPROVED', async () => {
			mockUserRepo.findByUnique.mockResolvedValue({ id: 99, isActive: true } as unknown as UserWithoutPassword);
			mockStepRepo.findById.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.APPROVED, // Ya estaba aprobado
			});
			mockStepRepo.reviewStep.mockResolvedValue({
				id: 1,
				userMissionId: 100,
				missionStepId: 10,
				status: StepStatus.APPROVED,
				reviewedById: 99,
			});

			await core.reviewStep(1, StepStatus.APPROVED, 99, 'Re-aprobado');

			expect(mockUserMissionRepo.updateCurrentStep).not.toHaveBeenCalled();
			expect(mockUserMissionRepo.updateStatus).not.toHaveBeenCalled();
		});
	});
});
