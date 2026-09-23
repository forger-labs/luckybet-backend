import { Test, TestingModule } from '@nestjs/testing';

import { MISIONES_CORE_PROVIDER } from '../../app/constants';
import { StepStatus } from '../../app/enums';
import type { ForManagePlayerMissions } from '../../ports/driven/ForManagePlayerMissions';
import { PlayerMisionesController } from './player-misiones.controller';

type MockCore = jest.Mocked<ForManagePlayerMissions>;

describe('PlayerMisionesController', () => {
	let controller: PlayerMisionesController;
	let mockCore: MockCore;

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
			],
		}).compile();

		controller = module.get<PlayerMisionesController>(PlayerMisionesController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// ─── POST submit step ───────────────────────────────────────────

	describe('submitStep', () => {
		it('debería llamar a misionesCore.submitStep y devolver response formateada', async () => {
			mockCore.submitStep.mockResolvedValue(mockStepSubmission);

			const result = await controller.submitStep(1, 3, submitDto);

			expect(mockCore.submitStep).toHaveBeenCalledWith(1, 3, submitDto);
			expect(result).toEqual({
				data: mockStepSubmission,
				message: 'Paso enviado exitosamente',
				status: true,
			});
		});
	});

	// ─── POST player/mission start ──────────────────────────────────

	describe('startMission', () => {
		it('debería llamar a misionesCore.startMission y devolver response formateada', async () => {
			mockCore.startMission.mockResolvedValue(mockUserMission);

			const result = await controller.startMission(10, 2);

			expect(mockCore.startMission).toHaveBeenCalledWith(10, 2);
			expect(result).toEqual({
				data: mockUserMission,
				message: 'Mision iniciada exitosamente',
				status: true,
			});
		});
	});

	// ─── GET player missions list ───────────────────────────────────

	describe('getPlayerMissions', () => {
		it('debería devolver respuesta paginada', async () => {
			mockCore.getPlayerMissions.mockResolvedValue({
				missions: [mockUserMission],
				total: 1,
				limit: 10,
				skip: 0,
			});

			const result = await controller.getPlayerMissions(10, 10, 0);

			expect(mockCore.getPlayerMissions).toHaveBeenCalledWith(10, { take: 10, skip: 0 });
			expect(result.data).toEqual([mockUserMission]);
			expect(result.message).toBe('Misiones obtenidas exitosamente');
			expect(result.status).toBe(true);
		});
	});

	// ─── GET player mission detail ──────────────────────────────────

	describe('getPlayerMission', () => {
		it('debería devolver la mision del jugador', async () => {
			mockCore.getPlayerMission.mockResolvedValue({ ...mockUserMission, steps: [] });

			const result = await controller.getPlayerMission(1);

			expect(mockCore.getPlayerMission).toHaveBeenCalledWith(1);
			expect(result.message).toBe('Mision obtenida exitosamente');
			expect(result.status).toBe(true);
		});
	});

	// ─── GET review queue ───────────────────────────────────────────

	describe('getPlayerMissionsQueue', () => {
		it('debería devolver la cola de revision paginada', async () => {
			mockCore.getPlayerMissionsQueue.mockResolvedValue({
				players: [mockStepSubmission as never],
				total: 1,
				limit: 100,
				skip: 0,
			});

			const result = await controller.getPlayerMissionsQueue();

			expect(mockCore.getPlayerMissionsQueue).toHaveBeenCalledWith({
				status: undefined,
				playerId: undefined,
				experience: undefined,
				coinsAmount: undefined,
				type: undefined,
				take: undefined,
				skip: undefined,
			});
			expect(result.message).toBe('Cola de revision obtenida exitosamente');
			expect(result.status).toBe(true);
		});
	});

	// ─── POST review step ───────────────────────────────────────────

	describe('reviewStep', () => {
		it('debería aprobar el paso con APPROVED', async () => {
			mockCore.reviewStep.mockResolvedValue(mockStepSubmission);

			const result = await controller.reviewStep(3, {
				status: 'APPROVED',
				reviewerNotes: 'Ok',
			});

			expect(mockCore.reviewStep).toHaveBeenCalledWith(3, StepStatus.APPROVED, 1, 'Ok');
			expect(result.message).toBe('Revision completada exitosamente');
		});

		it('debería rechazar el paso con REJECTED', async () => {
			mockCore.reviewStep.mockResolvedValue(mockStepSubmission);

			const result = await controller.reviewStep(3, { status: 'REJECTED' });

			expect(mockCore.reviewStep).toHaveBeenCalledWith(
				3,
				StepStatus.REJECTED,
				1,
				undefined,
			);
			expect(result.message).toBe('Revision completada exitosamente');
		});
	});
});
