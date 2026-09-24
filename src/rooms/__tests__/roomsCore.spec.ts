import { ConflictException, NotFoundException } from '@nestjs/common';

import { BonusIntern } from '../../types/bonus';
import { RoomsCore } from '../app/roomsCore';
import type { ForDatabaseRooms } from '../ports/driver/ForDatabaseRooms';

describe('RoomsCore', () => {
	let core: RoomsCore;
	let mockRepo: jest.Mocked<ForDatabaseRooms>;

	const mockRoom = {
		id: 1,
		name: 'SuperAla200%',
		bonus: BonusIntern.TwoHundred,
		isActive: true,
	};

	beforeEach(() => {
		mockRepo = {
			createRoom: jest.fn(),
			findById: jest.fn(),
			findByName: jest.fn(),
			updateRoom: jest.fn(),
			getRooms: jest.fn(),
			findActiveRooms: jest.fn(),
		};

		core = new RoomsCore(mockRepo);
	});

	describe('createRoom', () => {
		it('debería crear una sala exitosamente', async () => {
			mockRepo.findByName.mockResolvedValue(null);
			mockRepo.createRoom.mockResolvedValue(mockRoom);

			const result = await core.createRoom({
				name: 'SuperAla200%',
				bonus: BonusIntern.TwoHundred,
				isActive: true,
			});

			expect(mockRepo.createRoom).toHaveBeenCalledWith({
				name: 'SuperAla200%',
				bonus: BonusIntern.TwoHundred,
				isActive: true,
			});
			expect(result.id).toBe(1);
		});

		it('debería lanzar ConflictException si ya existe una sala con el mismo nombre', async () => {
			mockRepo.findByName.mockResolvedValue(mockRoom);

			await expect(
				core.createRoom({
					name: 'SuperAla200%',
					bonus: BonusIntern.TwoHundred,
					isActive: true,
				}),
			).rejects.toThrow(ConflictException);
		});
	});

	describe('getRoom', () => {
		it('debería retornar la sala si existe', async () => {
			mockRepo.findById.mockResolvedValue(mockRoom);

			const result = await core.getRoom(1);

			expect(result.name).toBe('SuperAla200%');
		});

		it('debería lanzar NotFoundException si no existe', async () => {
			mockRepo.findById.mockResolvedValue(null);

			await expect(core.getRoom(99)).rejects.toThrow(NotFoundException);
		});
	});

	describe('listRooms', () => {
		it('debería retornar listado paginado con filtros', async () => {
			mockRepo.getRooms.mockResolvedValue([[mockRoom], 1]);

			const result = await core.listRooms({
				name: 'SuperAla',
				bonus: BonusIntern.TwoHundred,
				isActive: true,
				take: 10,
				skip: 0,
			});

			expect(mockRepo.getRooms).toHaveBeenCalledWith({
				name: 'SuperAla',
				bonus: BonusIntern.TwoHundred,
				isActive: true,
				take: 10,
				skip: 0,
			});
			expect(result.rooms).toHaveLength(1);
			expect(result.total).toBe(1);
		});
	});
});
