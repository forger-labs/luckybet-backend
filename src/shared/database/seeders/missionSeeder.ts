import type { QueryRunner } from 'typeorm';

import { Mission } from '../../../misiones/app/entities/mission.entity';
import { MissionStep } from '../../../misiones/app/entities/mission-step.entity';
import { MissionStatus, MissionType, StepType } from '../../../misiones/app/enums';

export interface SeedMissionData {
	title: string;
	description: string;
	type: MissionType;
	status: MissionStatus;
	coinsAmount: number;
	experiencePoints: number;
	roomId?: number | null;
	imageUrl?: string;
	activatedAt?: Date;
	expiresAt?: Date;
	steps: {
		stepOrder: number;
		type: StepType;
		content: string;
		targetConfig?: Record<string, unknown> | null;
	}[];
}

export const MISSIONS_SEED_DATA: SeedMissionData[] = [
	// ─── DAILY MISSIONS (1 - 4 coins) ──────────────────────────────────
	{
		title: 'Giro Diario de la Suerte',
		description:
			'Realiza al menos 1 jugada en cualquier slot de Pragmatic Play para reclamar tu recompensa diaria.',
		type: MissionType.DAILY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 2,
		experiencePoints: 20,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/daily-spin.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega al menos 1 ronda en Pragmatic Play (apuesta mínima: 1 coin)',
				targetConfig: {
					provider: 'Pragmatic Play',
					minBet: 1,
					minUniqueGames: 1,
				},
			},
		],
	},
	{
		title: 'Explorador de Slots Diario',
		description:
			'Diversifica tu juego probando al menos 2 títulos diferentes del proveedor Pragmatic Play.',
		type: MissionType.DAILY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 3,
		experiencePoints: 30,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/slot-explorer.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega en al menos 2 juegos distintos de Pragmatic Play con apuesta mínima de 1 coin',
				targetConfig: {
					provider: 'Pragmatic Play',
					minBet: 1,
					minUniqueGames: 2,
				},
			},
		],
	},
	{
		title: 'Reto Diario de Comunidad',
		description:
			'Juega en mesas en vivo de Evolution y comparte tu experiencia con la comunidad.',
		type: MissionType.DAILY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 4,
		experiencePoints: 40,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/daily-challenge.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega en cualquier mesa de Evolution con apuesta mínima de 2 coins',
				targetConfig: {
					provider: 'Evolution',
					minBet: 2,
					minUniqueGames: 1,
				},
			},
			{
				stepOrder: 2,
				type: StepType.TEXT,
				content: 'Escribe un comentario breve sobre tu partida del día',
			},
		],
	},

	// ─── WEEKLY MISSIONS (5 - 10 coins) ────────────────────────────────
	{
		title: 'Maratón Semanal Pragmatic',
		description:
			'Completa el recorrido semanal explorando 3 juegos distintos y subiendo tu mejor jugada.',
		type: MissionType.WEEKLY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 6,
		experiencePoints: 60,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/weekly-marathon.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega en 3 slots diferentes de Pragmatic Play con apuesta mínima de 2 coins',
				targetConfig: {
					provider: 'Pragmatic Play',
					minBet: 2,
					minUniqueGames: 3,
				},
			},
			{
				stepOrder: 2,
				type: StepType.IMAGE,
				content:
					'Sube una captura de pantalla de tu mayor ganancia o multiplicador de la semana',
			},
		],
	},
	{
		title: 'Dúo Dinámico de Slots',
		description:
			'Demuestra tu destreza en los dos clásicos más populares: Sweet Bonanza y Gates of Olympus.',
		type: MissionType.WEEKLY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 8,
		experiencePoints: 80,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/dynamic-duo.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content: 'Juega en Sweet Bonanza con apuesta mínima de 2 coins',
				targetConfig: {
					gameId: 'sweet-bonanza',
					minBet: 2,
				},
			},
			{
				stepOrder: 2,
				type: StepType.GAME_PLAY,
				content: 'Juega en Gates of Olympus con apuesta mínima de 2 coins',
				targetConfig: {
					gameId: 'gates-of-olympus',
					minBet: 2,
				},
			},
		],
	},
	{
		title: 'Desafío Titán: Torneo Multi-Proveedor',
		description:
			'Misión semanal para jugadores avanzados: domina múltiples juegos de alta volatilidad y sube tu comprobante de ronda de bono.',
		type: MissionType.WEEKLY,
		status: MissionStatus.ACTIVE,
		coinsAmount: 10,
		experiencePoints: 100,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/titan-challenge.png',
		activatedAt: new Date(),
		expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega en 4 slots distintas de Pragmatic Play con apuesta mínima de 3 coins',
				targetConfig: {
					provider: 'Pragmatic Play',
					minBet: 3,
					minUniqueGames: 4,
				},
			},
			{
				stepOrder: 2,
				type: StepType.IMAGE,
				content:
					'Sube captura de pantalla de una ronda de Free Spins o bono desbloqueada',
			},
		],
	},

	// ─── FIXED / ONBOARDING MISSIONS (1 - 12 coins - MAX 12) ───────────
	{
		title: 'Bienvenido a LuckyBet',
		description:
			'¡Te damos la bienvenida a la plataforma! Cuéntanos tus preferencias de juego para empezar.',
		type: MissionType.FIXED,
		status: MissionStatus.ACTIVE,
		coinsAmount: 1,
		experiencePoints: 10,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/welcome.png',
		activatedAt: new Date(),
		steps: [
			{
				stepOrder: 1,
				type: StepType.TEXT,
				content:
					'¿Cuáles son los tipos de juegos o temáticas que más te gusta jugar en LuckyBet?',
			},
		],
	},
	{
		title: 'Primer Desafío Hacksaw',
		description:
			'Conoce los títulos innovadores de Hacksaw Gaming y verifica tu perfil de jugador.',
		type: MissionType.FIXED,
		status: MissionStatus.ACTIVE,
		coinsAmount: 5,
		experiencePoints: 50,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/hacksaw-first.png',
		activatedAt: new Date(),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega al menos 1 ronda en cualquier juego de Hacksaw Gaming (apuesta mínima: 1 coin)',
				targetConfig: {
					provider: 'Hacksaw Gaming',
					minBet: 1,
					minUniqueGames: 1,
				},
			},
			{
				stepOrder: 2,
				type: StepType.IMAGE,
				content: 'Sube una captura de pantalla de tu perfil configurado',
			},
		],
	},
	{
		title: 'Estratega de Mesas en Vivo',
		description:
			'Ponte a prueba en las mesas en vivo y comparte tu análisis táctico con el equipo.',
		type: MissionType.FIXED,
		status: MissionStatus.ACTIVE,
		coinsAmount: 7,
		experiencePoints: 70,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/table-master.png',
		activatedAt: new Date(),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content:
					'Juega en Ruleta en Vivo con apuesta mínima de 3 coins',
				targetConfig: {
					gameId: 'live-roulette',
					minBet: 3,
				},
			},
			{
				stepOrder: 2,
				type: StepType.TEXT,
				content:
					'Explica brevemente qué estrategia o gestión de saldo aplicaste durante la sesión',
			},
		],
	},
	{
		title: 'Gran Maestro LuckyBet (Premio Supremo)',
		description:
			'La cúspide de los desafíos en LuckyBet. Conquista slots épicas, prueba NoLimit City, documenta tu racha y deja tu reseña de maestro.',
		type: MissionType.FIXED,
		status: MissionStatus.ACTIVE,
		coinsAmount: 12,
		experiencePoints: 120,
		roomId: null,
		imageUrl: 'https://cdn.luckybet.com/missions/grandmaster.png',
		activatedAt: new Date(),
		steps: [
			{
				stepOrder: 1,
				type: StepType.GAME_PLAY,
				content: 'Juega en Sugar Rush con apuesta mínima de 4 coins',
				targetConfig: {
					gameId: 'sugar-rush',
					minBet: 4,
				},
			},
			{
				stepOrder: 2,
				type: StepType.GAME_PLAY,
				content:
					'Juega en al menos 2 juegos del proveedor NoLimit City con apuesta mínima de 4 coins',
				targetConfig: {
					provider: 'NoLimit City',
					minBet: 4,
					minUniqueGames: 2,
				},
			},
			{
				stepOrder: 3,
				type: StepType.IMAGE,
				content:
					'Sube una captura del historial de juego que demuestre tu racha destacada',
			},
			{
				stepOrder: 4,
				type: StepType.TEXT,
				content:
					'Envía una reseña y recomendación de juego para la comunidad LuckyBet',
			},
		],
	},
];

export async function missionSeeder(queryRunner: QueryRunner): Promise<void> {
	const missionRepo = queryRunner.dataSource.getRepository(Mission);
	const stepRepo = queryRunner.dataSource.getRepository(MissionStep);

	for (const data of MISSIONS_SEED_DATA) {
		const existing = await missionRepo.findOneBy({ title: data.title });
		if (existing) {
			continue;
		}

		const { steps, ...missionFields } = data;
		const mission = missionRepo.create({
			...missionFields,
			createdById: 1,
		} as Partial<Mission>);

		const savedMission = await missionRepo.save(mission);

		const stepEntities = steps.map(s =>
			stepRepo.create({
				missionId: savedMission.id,
				stepOrder: s.stepOrder,
				type: s.type,
				content: s.content,
				targetConfig: s.targetConfig ?? null,
			}),
		);

		await stepRepo.save(stepEntities);
	}
}

export async function missionDown(queryRunner: QueryRunner): Promise<void> {
	const titles = MISSIONS_SEED_DATA.map(m => m.title);
	await queryRunner.query(
		`DELETE FROM missions WHERE title = ANY($1)`,
		[titles],
	);
}
