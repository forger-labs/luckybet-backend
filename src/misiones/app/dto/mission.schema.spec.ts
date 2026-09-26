import {
	createMissionMultipartSchema,
	createMissionStepSchema,
	submitStepMultipartSchema,
} from './mission.schema';

describe('createMissionMultipartSchema (Zod)', () => {
	const validImage = {
		buffer: Buffer.from('fake-image-bytes'),
		filename: 'portada.png',
		mimetype: 'image/png',
	};

	const baseFields = {
		title: 'Mision de prueba',
		type: 'DAILY',
		coinsAmount: '100',
		experiencePoints: '250',
	};

	// ─── Coerción de números ────────────────────────────────────

	describe('coerción string → number', () => {
		it('debería convertir coinsAmount y experiencePoints de string a number', () => {
			const result = createMissionMultipartSchema.parse({
				...baseFields,
				image: validImage,
			});
			expect(result.coinsAmount).toBe(100);
			expect(result.experiencePoints).toBe(250);
			expect(typeof result.coinsAmount).toBe('number');
		});

		it('debería aceptar roomId opcional y convertirlo a number', () => {
			const result = createMissionMultipartSchema.parse({
				...baseFields,
				roomId: '2',
				image: validImage,
			});
			expect(result.roomId).toBe(2);
			expect(typeof result.roomId).toBe('number');
		});

		it('debería rechazar un valor no numérico en coinsAmount', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				coinsAmount: 'abc',
				image: validImage,
			});
			expect(result.success).toBe(false);
		});

		it('debería rechazar un decimal en experiencePoints', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				experiencePoints: '12.5',
				image: validImage,
			});
			expect(result.success).toBe(false);
		});
	});

	// ─── missionSteps ───────────────────────────────────────────

	describe('missionSteps', () => {
		it('debería aceptar missionSteps como string JSON', () => {
			const result = createMissionMultipartSchema.parse({
				...baseFields,
				missionSteps: '[{"stepOrder":1,"type":"TEXT","content":"Paso uno"}]',
				image: validImage,
			});
			expect(result.missionSteps).toHaveLength(1);
			expect(result.missionSteps[0].content).toBe('Paso uno');
		});

		it('debería aceptar missionSteps como array ya parseado', () => {
			const result = createMissionMultipartSchema.parse({
				...baseFields,
				missionSteps: [{ stepOrder: 1, type: 'TEXT', content: 'Paso uno' }],
				image: validImage,
			});
			expect(result.missionSteps).toHaveLength(1);
			expect(result.missionSteps[0].stepOrder).toBe(1);
		});

		it('debería aceptar un paso GAME_PLAY con targetConfig', () => {
			const result = createMissionMultipartSchema.parse({
				...baseFields,
				missionSteps: [
					{
						stepOrder: 1,
						type: 'GAME_PLAY',
						content: 'Juega 3 partidas',
						targetConfig: { provider: 'Pragmatic Play', minUniqueGames: 3 },
					},
				],
				image: validImage,
			});
			expect(result.missionSteps).toHaveLength(1);
			expect(result.missionSteps[0].type).toBe('GAME_PLAY');
			expect(result.missionSteps[0].targetConfig).toEqual({
				provider: 'Pragmatic Play',
				minUniqueGames: 3,
			});
		});

		it('debería fallar con missionSteps malformado', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				missionSteps: '{json malformado',
				image: validImage,
			});
			expect(result.success).toBe(false);
		});

		it('debería fallar si missionSteps no es un array', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				missionSteps: '{"stepOrder":1}',
				image: validImage,
			});
			expect(result.success).toBe(false);
		});
	});

	// ─── image requerido ────────────────────────────────────────

	describe('image', () => {
		it('debería fallar si falta image', () => {
			const { image: _image, ...sinImagen } = { ...baseFields, image: validImage };
			const result = createMissionMultipartSchema.safeParse(sinImagen);
			expect(result.success).toBe(false);
			expect(result.error?.issues.some(issue => issue.path[0] === 'image')).toBe(true);
		});

		it('debería aceptar un archivo JPEG válido', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				image: { ...validImage, mimetype: 'image/jpeg' },
			});
			expect(result.success).toBe(true);
		});

		it('debería rechazar mimetype image/gif', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				image: { ...validImage, mimetype: 'image/gif' },
			});
			expect(result.success).toBe(false);
		});

		it('debería rechazar mimetype text/plain', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				image: { ...validImage, mimetype: 'text/plain' },
			});
			expect(result.success).toBe(false);
		});

		it('debería rechazar un buffer mayor a 5 MiB', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				image: {
					...validImage,
					buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
				},
			});
			expect(result.success).toBe(false);
		});

		it('debería aceptar un buffer de exactamente 5 MiB', () => {
			const result = createMissionMultipartSchema.safeParse({
				...baseFields,
				image: {
					...validImage,
					buffer: Buffer.alloc(5 * 1024 * 1024),
				},
			});
			expect(result.success).toBe(true);
		});
	});
});

describe('createMissionStepSchema (Zod)', () => {
	it('no debería incluir imageUrl en el resultado parseado', () => {
		const result = createMissionStepSchema.parse({
			stepOrder: 1,
			type: 'TEXT',
			content: 'Paso uno',
			imageUrl: 'https://example.com/step.png',
		});
		expect(result).not.toHaveProperty('imageUrl');
	});

	it('debería validar correctamente un paso GAME_PLAY', () => {
		const result = createMissionStepSchema.parse({
			stepOrder: 2,
			type: 'GAME_PLAY',
			content: 'Jugar Pragmatic Play',
			targetConfig: {
				provider: 'Pragmatic Play',
				minUniqueGames: 2,
			},
		});
		expect(result.type).toBe('GAME_PLAY');
		expect(result.targetConfig).toEqual({
			provider: 'Pragmatic Play',
			minUniqueGames: 2,
		});
	});
});

describe('submitStepMultipartSchema (Zod)', () => {
	const validImage = {
		buffer: Buffer.from('fake-image-bytes'),
		filename: 'respuesta.png',
		mimetype: 'image/png',
	};

	it('debería aceptar submissionText string', () => {
		const result = submitStepMultipartSchema.safeParse({
			submissionText: 'Mi respuesta',
		});
		expect(result.success).toBe(true);
	});

	it('debería aceptar submissionImage con buffer/filename/mimetype JPEG', () => {
		const result = submitStepMultipartSchema.safeParse({
			submissionImage: { ...validImage, mimetype: 'image/jpeg' },
		});
		expect(result.success).toBe(true);
	});

	it('debería rechazar mimetype inválido en submissionImage', () => {
		const result = submitStepMultipartSchema.safeParse({
			submissionImage: { ...validImage, mimetype: 'image/gif' },
		});
		expect(result.success).toBe(false);
	});

	it('debería rechazar submissionImage mayor a 5 MiB', () => {
		const result = submitStepMultipartSchema.safeParse({
			submissionImage: {
				...validImage,
				buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
			},
		});
		expect(result.success).toBe(false);
	});

	it('debería aceptar submissionImage de exactamente 5 MiB', () => {
		const result = submitStepMultipartSchema.safeParse({
			submissionImage: {
				...validImage,
				buffer: Buffer.alloc(5 * 1024 * 1024),
			},
		});
		expect(result.success).toBe(true);
	});

	it('debería aceptar un objeto vacío (ambos opcionales)', () => {
		const result = submitStepMultipartSchema.safeParse({});
		expect(result.success).toBe(true);
	});
	describe('targetConfig validaciones estrictas (GAME_PLAY)', () => {
		it('debería rechazar si se especifican provider y gameId simultáneamente', () => {
			const result = createMissionStepSchema.safeParse({
				stepOrder: 1,
				type: 'GAME_PLAY',
				targetConfig: {
					provider: 'Pragmatic Play',
					gameId: 'sweet_bonanza',
				},
			});
			expect(result.success).toBe(false);
		});

		it('debería rechazar si se especifica gameId y minUniqueGames es mayor a 1', () => {
			const result = createMissionStepSchema.safeParse({
				stepOrder: 1,
				type: 'GAME_PLAY',
				targetConfig: {
					gameId: 'sweet_bonanza',
					minUniqueGames: 2,
				},
			});
			expect(result.success).toBe(false);
		});

		it('debería aceptar gameId con minUniqueGames = 1', () => {
			const result = createMissionStepSchema.safeParse({
				stepOrder: 1,
				type: 'GAME_PLAY',
				targetConfig: {
					gameId: 'sweet_bonanza',
					minUniqueGames: 1,
					minBet: 10,
				},
			});
			expect(result.success).toBe(true);
		});

		it('debería aceptar provider con minUniqueGames > 1', () => {
			const result = createMissionStepSchema.safeParse({
				stepOrder: 1,
				type: 'GAME_PLAY',
				targetConfig: {
					provider: 'Pragmatic Play',
					minUniqueGames: 3,
					minBet: 5,
				},
			});
			expect(result.success).toBe(true);
		});
	});
});
