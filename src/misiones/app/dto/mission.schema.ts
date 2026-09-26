import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { BonusIntern } from '@/src/types/bonus';
import {
  apiResponseSchema,
  paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import type { StepTargetConfig } from '../entities/mission-step.entity';
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
  roomId: {
    int: 'roomId debe ser un numero entero',
    min: 'Minimo 1 para el ID de sala',
    describe: 'ID de la sala con bono asignada a la mision',
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
  minBet: {
    int: 'minBet debe ser un numero entero',
    min: 'Minimo 1 para la apuesta',
    describe: 'Minimo de apuesta en el paso',
  },
  content: {
    describe: 'Contenido o instruccion del paso',
  },
  targetConfig: {
    describe:
      'Configuracion de validacion automatica para el paso (ej: GAME_PLAY)',
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

// ─── Target Config Schema ──────────────────────────────────────
export const gamePlayStepConfigSchema = z.object({
  provider: z
    .string()
    .optional()
    .describe('Proveedor del juego (ej: Pragmatic Play)'),
  gameId: z.string().optional().describe('ID o nombre exacto del juego'),
  minUniqueGames: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Cantidad minima de juegos unicos jugados'),
  minBet: z
    .number(validationMissionMessages.minBet.int)
    .int()
    .min(1, validationMissionMessages.minBet.min)
    .optional()
    .describe(validationMissionMessages.minBet.describe),
});

export const stepTargetConfigSchema = gamePlayStepConfigSchema
  .passthrough()
  .optional()
  .nullable();

// ─── Mission Step Schema ───────────────────────────────────────
export const createMissionStepSchema = z.object({
  stepOrder: z
    .number(validationMissionMessages.stepOrder.int)
    .int()
    .min(1, validationMissionMessages.stepOrder.min)
    .describe(validationMissionMessages.stepOrder.describe),
  type: z.enum(StepType).describe('Tipo de paso: IMAGE, TEXT o GAME_PLAY'),
  content: z
    .string()
    .optional()
    .describe(validationMissionMessages.content.describe),
  targetConfig: stepTargetConfigSchema.describe(
    validationMissionMessages.targetConfig.describe,
  ),
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
  roomId: z
    .number(validationMissionMessages.roomId.int)
    .int()
    .min(1, validationMissionMessages.roomId.min)
    .optional()
    .nullable()
    .describe(validationMissionMessages.roomId.describe),
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
        (value) => ['image/jpeg', 'image/png', 'image/webp'].includes(value),
        validationMissionMessages.image.mimetype,
      ),
  })
  .refine(
    (file) => file.buffer.length <= 5 * 1024 * 1024,
    validationMissionMessages.image.size,
  );

// ─── Multipart create mission schema ───────────────────────────
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
  roomId: z.coerce
    .number(validationMissionMessages.roomId.int)
    .int()
    .min(1, validationMissionMessages.roomId.min)
    .optional()
    .nullable()
    .describe(validationMissionMessages.roomId.describe),
  experiencePoints: z.coerce
    .number(validationMissionMessages.experiencePoints.int)
    .int()
    .min(0, validationMissionMessages.experiencePoints.min)
    .describe(validationMissionMessages.experiencePoints.describe),
  missionSteps: z
    .preprocess((value) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }, z.array(createMissionStepSchema).max(50, validationMissionMessages.missionSteps.max).optional().default([]))
    .describe(validationMissionMessages.missionSteps.describe),
  image: missionImageSchema.describe(validationMissionMessages.image.describe),
});

// ─── Submit Step Multipart Schema ─────────────────────────────
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
  roomId?: number | null;
  experiencePoints: number;
  imageUrl?: string;
  activatedAt?: Date;
  expiresAt?: Date;
  room?: {
    id?: number;
    name?: string;
    bonus?: BonusIntern;
  };
};

export type MissionStepBasic = {
  id: number;
  missionId: number;
  stepOrder: number;
  type: StepType;
  content?: string;
  targetConfig?: StepTargetConfig | null;
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
export const MissionListResponseSchema =
  paginatedResponseSchema(createMissionSchema);

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
export class MissionListResponseDto extends createZodDto(
  MissionListResponseSchema,
) {}
export class UserMissionResponseDto extends createZodDto(
  apiResponseSchema(z.object({})),
) {}
export class StepResponseDto extends createZodDto(
  apiResponseSchema(z.object({})),
) {}
export class PlayerMissionsQueueResponseDto extends createZodDto(
  PlayerMissionsQueueResponseSchema,
) {}

// ─── Filter Schemas ───────────────────────────────────────────
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const missionFilterSchema = z.object({
  title: z.string().optional().describe('Búsqueda parcial por título'),
  type: z
    .enum(MissionType)
    .optional()
    .describe('Tipo de misión: DAILY, WEEKLY o FIXED'),
  status: z.enum(MissionStatus).optional().describe('Estado de la misión'),
  roomId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filtrar por ID de sala'),
  minCoins: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Monedas mínimas (>=)'),
  maxCoins: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Monedas máximas (<=)'),
  minExperience: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Experiencia mínima (>=)'),
  maxExperience: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Experiencia máxima (<=)'),
  orderDirection: z
    .enum(SortOrder)
    .default(SortOrder.DESC)
    .optional()
    .describe('Orden por fecha de creación (ASC o DESC, por defecto DESC)'),
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe('Cantidad de registros'),
  skip: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Paginación / Offset'),
});

export const userMissionFilterSchema = z.object({
  status: z
    .enum(['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED'])
    .optional()
    .describe('Estado de la misión de usuario'),
  missionId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Filtrar por plantilla de misión'),
  orderDirection: z
    .enum(SortOrder)
    .default(SortOrder.DESC)
    .optional()
    .describe('Orden por fecha de creación (ASC o DESC, por defecto DESC)'),
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe('Cantidad de registros'),
  skip: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Paginación / Offset'),
});

export type MissionFilter = z.infer<typeof missionFilterSchema>;
export type UserMissionFilter = z.infer<typeof userMissionFilterSchema>;

export class MissionFilterDto extends createZodDto(missionFilterSchema) {}
export class UserMissionFilterDto extends createZodDto(
  userMissionFilterSchema,
) {}
