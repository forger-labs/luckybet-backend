import { Test, TestingModule } from '@nestjs/testing';

import { FOR_PANEL_API_CORE } from '../../../panelApi/constants';
import type { PlayerAuthContext } from '../../../panelApi/types/panelApiCore.types';
import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { StepStatus } from '../../app/enums';
import type { ForManagePlayerMissions } from '../../ports/driven/ForManagePlayerMissions';
import { PlayerMisionesController } from './player-misiones.controller';

type MockCore = jest.Mocked<ForManagePlayerMissions>;

describe('PlayerMisionesController', () => {
	let controller: PlayerMisionesController;
	let mockCore: MockCore;

	const mockPlayer: PlayerAuthContext = {
		id: 10,
		username: 'testplayer',
		phone: '123456789',
		cash: 100,
		currency: 'ARS',
		isActive: true,
		experience: 0,
		isNewlyRegistered: false,
	};

	const mockUserMission = {
		id: 1,
		playerId: 10,
		missionId: 2,
		status: 'IN_PROGRESS',
		currentStep: 1,
		startedAt: new Date(),
	};

	const mockStepSubmission = {
		id: 1,
		userMissionId: 1,
		missionStepId: 3,
		status: StepStatus.PENDING,
	};

	const submitDto = {
		submissionText: 'Mi respuesta',
		submissionImage: {
			buffer: Buffer.from('fake-bytes'),
			filename: 'respuesta.png',
			mimetype: 'image/png',
		},
	};

	beforeEach(async () => {
		mockCore = {
			startMission: jest.fn(),
			submitStep: jest.fn(),
			verifyAutoStep: jest.fn(),
			reviewStep: jest.fn(),
			getPlayerMissions: jest.fn(),
			getPlayerMission: jest.fn(),
			getPlayerMissionsQueue: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PlayerMisionesController],
			providers: [
				{
					provide: MISIONES_CORE_PROVIDER,
					useValue: mockCore,
				},
				{
					provide: FOR_PANEL_API_CORE,
					useValue: {
						authenticatePlayer: jest.fn().mockResolvedValue(mockPlayer),
					},
				},
			],
		}).compile();

		controller = module.get<PlayerMisionesController>(PlayerMisionesController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// ─── POST player/mission start ──────────────────────────────────

	describe('startMission', () => {
		it('debería llamar a misionesCore.startMission con player.id y devolver response formateada', async () => {
			mockCore.startMission.mockResolvedValue(mockUserMission);

			const result = await controller.startMission(2, mockPlayer);

			expect(mockCore.startMission).toHaveBeenCalledWith(10, 2);
			expect(result).toEqual({
				data: mockUserMission,
				message: 'Mision iniciada exitosamente',
				status: true,
			});
		});
	});

	// ─── POST submit step ───────────────────────────────────────────

	describe('submitStep', () => {
		it('debería llamar a misionesCore.submitStep con player.id y devolver response formateada', async () => {
			mockCore.submitStep.mockResolvedValue(mockStepSubmission);

			const result = await controller.submitStep(1, 3, submitDto, mockPlayer);

			expect(mockCore.submitStep).toHaveBeenCalledWith(1, 3, submitDto, 10);
			expect(result).toEqual({
				data: mockStepSubmission,
				message: 'Paso enviado exitosamente',
				status: true,
			});
		});
	});

	// ─── POST verify auto step ──────────────────────────────────────

	describe('verifyAutoStep', () => {
		it('debería llamar a misionesCore.verifyAutoStep con player.id y token', async () => {
			mockCore.verifyAutoStep.mockResolvedValue({
				...mockStepSubmission,
				status: StepStatus.APPROVED,
			});

			const result = await controller.verifyAutoStep(1, 3, mockPlayer, 'token123');

			expect(mockCore.verifyAutoStep).toHaveBeenCalledWith(1, 3, 10, 'token123');
			expect(result).toEqual({
				data: {
					...mockStepSubmission,
					status: StepStatus.APPROVED,
				},
				message: 'Paso automatico verificado exitosamente',
				status: true,
			});
		});
	});

	// ─── GET player missions list ───────────────────────────────────

	describe('getPlayerMissions', () => {
		it('debería devolver respuesta paginada para el jugador autenticado', async () => {
			mockCore.getPlayerMissions.mockResolvedValue({
				missions: [mockUserMission],
				total: 1,
				limit: 10,
				skip: 0,
			});

			const result = await controller.getPlayerMissions(mockPlayer, {
				take: 10,
				skip: 0,
			});

			expect(mockCore.getPlayerMissions).toHaveBeenCalledWith(10, { take: 10, skip: 0 });
			expect(result.data).toEqual([mockUserMission]);
			expect(result.message).toBe('Misiones obtenidas exitosamente');
			expect(result.status).toBe(true);
		});
	});

	// ─── GET player mission detail ──────────────────────────────────

	describe('getPlayerMission', () => {
		it('debería llamar a misionesCore.getPlayerMission con userMissionId y player.id', async () => {
			const mockDetail = { ...mockUserMission, steps: [mockStepSubmission] };
			mockCore.getPlayerMission.mockResolvedValue(mockDetail);

			const result = await controller.getPlayerMission(1, mockPlayer);

			expect(mockCore.getPlayerMission).toHaveBeenCalledWith(1, 10);
			expect(result).toEqual({
				data: mockDetail,
				message: 'Mision obtenida exitosamente',
				status: true,
			});
		});
	});
});
