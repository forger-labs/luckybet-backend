import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { MissionStatus, MissionType, StepType } from '../enums';

export const validationMissionMessages = {
	title: {
		string: 'title es obligatorio como string',
		min: 'Minimo 1 caracter para el titulo',
		max: 'Maximo 200 caracteres para el titulo',
		describe: 'Titulo de la mision',
	},
	description: {
		describe: 'Descripcion de la mision',
	},
	status: {
		enum: 'Valores validos: INACTIVE, ACTIVE, COMPLETED, CANCELLED',
		describe: 'Status de la mision',
	},
	type: {
		enum: 'Valores validos: DAILY, WEEKLY, FIXED',
		describe: 'Tipo de mision',
	},
	coinsAmount: {
		int: 'coinsAmount debe ser un numero entero',
		min: 'Minimo 0 chips',
		describe: 'Cantidad de chips de recompensa base',
	},
	bonus: {
		int: 'bonus debe ser un numero entero',
		min: 'Minimo 0 chips de bonus',
		describe: 'Chips de bonus adicional',
	},
	experiencePoints: {
		int: 'experiencePoints debe ser un numero entero',
		min: 'Minimo 0 puntos de experiencia',
		describe: 'Puntos de experiencia',
	},
	imageUrl: {
		url: 'imageUrl debe tener un formato URL valido',
		max: 'Maximo 500 caracteres para la URL',
		describe: 'URL de la imagen de portada',
	},
	image: {
		buffer: 'El archivo debe ser un buffer valido',
		filename: 'El archivo debe tener un nombre',
		mimetype: 'Solo se permiten imagenes JPEG o PNG',
		size: 'La imagen no puede superar los 5 MiB',
		describe: 'Imagen de portada de la mision (JPEG o PNG, maximo 5 MiB)',
	},
	missionSteps: {
		max: 'Maximo 50 pasos por mision',
		describe: 'Pasos de la mision',
	},
	stepOrder: {
		int: 'stepOrder debe ser un numero entero',
		min: 'Minimo 1 para el orden del paso',
		describe: 'Orden del paso dentro de la mision',
	},
	content: {
		describe: 'Contenido o instruccion del paso',
	},

	submissionText: {
		describe: 'Texto enviado por el jugador',
	},
	submissionImageUrl: {
		url: 'submissionImageUrl debe tener un formato URL valido',
		max: 'Maximo 500 caracteres para la URL',
		describe: 'URL de la imagen enviada por el jugador',
	},
	submissionImage: {
		describe: 'Imagen enviada por el jugador (JPEG o PNG, maximo 5 MiB)',
	},
	reviewerNotes: {
		describe: 'Notas del revisor sobre la submission',
	},
};

// ─── Mission Step Schema ───────────────────────────────────────
export const createMissionStepSchema = z.object({
	stepOrder: z
		.number(validationMissionMessages.stepOrder.int)
		.int()
		.min(1, validationMissionMessages.stepOrder.min)
		.describe(validationMissionMessages.stepOrder.describe),
	type: z.enum(StepType).describe('Tipo de paso: IMAGE o TEXT'),
	content: z.string().optional().describe(validationMissionMessages.content.describe),
});

// ─── Base Mission Schema ───────────────────────────────────────
export const createMissionSchema = z.object({
	title: z
		.string(validationMissionMessages.title.string)
		.min(1, validationMissionMessages.title.min)
		.max(200, validationMissionMessages.title.max)
		.describe(validationMissionMessages.title.describe),
	description: z
		.string()
		.optional()
		.describe(validationMissionMessages.description.describe),
	type: z
		.enum(MissionType, validationMissionMessages.type.enum)
		.describe(validationMissionMessages.type.describe),
	coinsAmount: z
		.number(validationMissionMessages.coinsAmount.int)
		.int()
		.min(0, validationMissionMessages.coinsAmount.min)
		.describe(validationMissionMessages.coinsAmount.describe),
	bonus: z
		.number(validationMissionMessages.bonus.int)
		.int()
		.min(0, validationMissionMessages.bonus.min)
		.optional()
		.describe(validationMissionMessages.bonus.describe),
	experiencePoints: z
		.number(validationMissionMessages.experiencePoints.int)
		.int()
		.min(0, validationMissionMessages.experiencePoints.min)
		.describe(validationMissionMessages.experiencePoints.describe),
	imageUrl: z
		.url(validationMissionMessages.imageUrl.url)
		.max(500, validationMissionMessages.imageUrl.max)
		.optional()
		.describe(validationMissionMessages.imageUrl.describe),
	missionSteps: z
		.array(createMissionStepSchema)
		.max(50, validationMissionMessages.missionSteps.max)
		.optional()
		.default([])
		.describe(validationMissionMessages.missionSteps.describe),
});

// ─── Multipart create image schema ─────────────────────────────
export const missionImageSchema = z
	.object({
		buffer: z
			.unknown()
			.refine(
				(value): value is Buffer => value instanceof Buffer,
				validationMissionMessages.image.buffer,
			),
		filename: z.string().min(1, validationMissionMessages.image.filename),
		mimetype: z
			.string()
			.refine(
				value => ['image/jpeg', 'image/png'].includes(value),
				validationMissionMessages.image.mimetype,
			),
	})
	.refine(
		file => file.buffer.length <= 5 * 1024 * 1024,
		validationMissionMessages.image.size,
	);

// ─── Multipart create mission schema ───────────────────────────
// Input schema for POST /missions (multipart/form-data). Numeric
// fields arrive as strings and are coerced; missionSteps may come
// as a JSON string or as an already-parsed array; the image file is
// attached to the body as { buffer, filename, mimetype } by the
// global multipart plugin hook.
export const createMissionMultipartSchema = z.object({
	title: z
		.string(validationMissionMessages.title.string)
		.min(1, validationMissionMessages.title.min)
		.max(200, validationMissionMessages.title.max)
		.describe(validationMissionMessages.title.describe),
	description: z
		.string()
		.optional()
		.describe(validationMissionMessages.description.describe),
	type: z
		.enum(MissionType, validationMissionMessages.type.enum)
		.describe(validationMissionMessages.type.describe),
	coinsAmount: z.coerce
		.number(validationMissionMessages.coinsAmount.int)
		.int()
		.min(0, validationMissionMessages.coinsAmount.min)
		.describe(validationMissionMessages.coinsAmount.describe),
	bonus: z.coerce
		.number(validationMissionMessages.bonus.int)
		.int()
		.min(0, validationMissionMessages.bonus.min)
		.optional()
		.describe(validationMissionMessages.bonus.describe),
	experiencePoints: z.coerce
		.number(validationMissionMessages.experiencePoints.int)
		.int()
		.min(0, validationMissionMessages.experiencePoints.min)
		.describe(validationMissionMessages.experiencePoints.describe),
	missionSteps: z
		.preprocess(value => {
			if (typeof value !== 'string') return value;
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		}, z
			.array(createMissionStepSchema)
			.max(50, validationMissionMessages.missionSteps.max)
			.optional()
			.default([]))
		.describe(validationMissionMessages.missionSteps.describe),
	image: missionImageSchema.describe(validationMissionMessages.image.describe),
});

// ─── Submit Step Multipart Schema ─────────────────────────────
// Input schema for POST players/:playerId/missions/:userMissionId/
// steps/:stepId/submit (multipart/form-data). The image file is
// attached to the body as { buffer, filename, mimetype } by the
// global multipart plugin hook. Content is validated against the
// step type in MisionesCore.
export const submitStepMultipartSchema = z.object({
	submissionText: z
		.string()
		.optional()
		.describe(validationMissionMessages.submissionText.describe),
	submissionImage: missionImageSchema
		.optional()
		.describe(validationMissionMessages.submissionImage.describe),
});

// ─── Review Step Schema ────────────────────────────────────────
export const reviewStepSchema = z.object({
	status: z.enum(['APPROVED', 'REJECTED']).describe('Estado de la revision'),
	reviewerNotes: z
		.string()
		.optional()
		.describe(validationMissionMessages.reviewerNotes.describe),
});

// ─── Change Status Schema ──────────────────────────────────────
export const changeStatusSchema = z.object({
	status: z.enum(MissionStatus).describe('Nuevo estado de la mision'),
});

// ─── Response Types ────────────────────────────────────────────
export type MissionBasic = {
	id: number;
	title: string;
	description?: string;
	type: MissionType;
	status: MissionStatus;
	coinsAmount: number;
	bonus?: number;
	experiencePoints: number;
	imageUrl?: string;
	activatedAt?: Date;
	expiresAt?: Date;
};

export type MissionStepBasic = {
	id: number;
	missionId: number;
	stepOrder: number;
	type: StepType;
	content?: string;
};

export type MissionWithSteps = MissionBasic & {
	steps: MissionStepBasic[];
};

export type UserMissionBasic = {
	id: number;
	playerId: number;
	missionId: number;
	status: string;
	currentStep: number;
	startedAt?: Date;
	completedAt?: Date;
};

export type StepSubmission = {
	id: number;
	userMissionId: number;
	missionStepId: number;
	status: string;
	submissionText?: string;
	submissionImageUrl?: string;
	reviewedById?: number;
	reviewedAt?: Date;
	reviewerNotes?: string;
};

export type UserMissionWithSteps = UserMissionBasic & {
	steps: StepSubmission[];
};

export type ReviewQueueByPlayer = {
	playerId: number;
	playerName?: string;
	missions: {
		userMissionId: number;
		missionId: number;
		missionTitle: string;
		missionDescription?: string;
		missionType: string;
		coinsAmount: number;
		experiencePoints: number;
		userMissionStatus: string;
		imageUrl?: string;
		steps: StepSubmission[];
	}[];
};

// ─── Swagger Response Schemas ──────────────────────────────────
export const MissionResponseSchema = apiResponseSchema(createMissionSchema);

export const MissionListResponseSchema = paginatedResponseSchema(createMissionSchema);

const stepSubmissionResponseSchema = z.object({
	id: z.number().int(),
	userMissionId: z.number().int(),
	missionStepId: z.number().int(),
	status: z.string(),
	submissionText: z.string().optional(),
	submissionImageUrl: z.string().optional(),
	reviewedById: z.number().int().optional(),
	reviewedAt: z.string().optional(),
	reviewerNotes: z.string().optional(),
});

const reviewQueueMissionSchema = z.object({
	userMissionId: z.number().int(),
	missionId: z.number().int(),
	missionTitle: z.string(),
	missionDescription: z.string().optional(),
	missionType: z.string(),
	coinsAmount: z.number().int(),
	experiencePoints: z.number().int(),
	userMissionStatus: z.string(),
	imageUrl: z.string().optional(),
	steps: z.array(stepSubmissionResponseSchema),
});

const reviewQueueByPlayerSchema = z.object({
	playerId: z.number().int(),
	playerName: z.string().optional(),
	missions: z.array(reviewQueueMissionSchema),
});

export const PlayerMissionsQueueResponseSchema = paginatedResponseSchema(
	reviewQueueByPlayerSchema,
);

// ─── Response DTOs ─────────────────────────────────────────────
export class MissionResponseDto extends createZodDto(MissionResponseSchema) {}
export class MissionListResponseDto extends createZodDto(MissionListResponseSchema) {}
export class UserMissionResponseDto extends createZodDto(
	apiResponseSchema(z.object({})),
) {}
export class StepResponseDto extends createZodDto(apiResponseSchema(z.object({}))) {}
export class PlayerMissionsQueueResponseDto extends createZodDto(
	PlayerMissionsQueueResponseSchema,
) {}
