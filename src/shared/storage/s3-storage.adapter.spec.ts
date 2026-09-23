import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

import { S3StorageAdapter } from './s3-storage.adapter';
import type { UploadableFile } from './storage.port';

jest.mock('@aws-sdk/client-s3', () => {
	const actual = jest.requireActual('@aws-sdk/client-s3');
	return {
		...actual,
		S3Client: jest.fn().mockImplementation(() => ({
			send: jest.fn().mockResolvedValue({}),
		})),
	};
});

const S3ClientMock = S3Client as unknown as jest.Mock;

describe('S3StorageAdapter', () => {
	const mockConfig = {
		get: jest.fn((key: string, defaultValue?: unknown) => {
			const values: Record<string, string> = {
				STORAGE_ENDPOINT: 'https://r2.example.com',
				STORAGE_REGION: 'auto',
				STORAGE_ACCESS_KEY_ID: 'access-key',
				STORAGE_ACCESS_KEY_SECRET: 'secret-key',
				STORAGE_BUCKET: 'luckybet-premios',
				STORAGE_PUBLIC_URL: 'https://cdn.example.com',
			};
			return values[key] ?? defaultValue;
		}),
	} as unknown as ConfigService;

	const file: UploadableFile = {
		buffer: Buffer.from('image-bytes'),
		filename: 'Mi Foto.PNG',
		mimetype: 'image/png',
	};

	let adapter: S3StorageAdapter;
	let sendMock: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		adapter = new S3StorageAdapter(mockConfig);
		sendMock = S3ClientMock.mock.results[0]?.value.send as jest.Mock;
	});

	it('debería estar definido', () => {
		expect(adapter).toBeDefined();
	});

	describe('uploadImage', () => {
		it('debería subir la imagen con folder y key sanitizada, y devolver la URL pública', async () => {
			const url = await adapter.uploadImage(file, 'missions');

			expect(sendMock).toHaveBeenCalledTimes(1);
			const command = sendMock.mock.calls[0][0] as PutObjectCommand;
			expect(command).toBeInstanceOf(PutObjectCommand);
			expect(command.input.Bucket).toBe('luckybet-premios');
			expect(command.input.ContentType).toBe('image/png');
			expect(command.input.Body).toEqual(file.buffer);
			expect(command.input.Key).toMatch(/^missions\/[0-9a-f-]+-mi-foto\.png$/);
			expect(url).toMatch(/^missions\/[0-9a-f-]+-mi-foto\.png$/);
		});

		it('debería usar el folder steps cuando se indica', async () => {
			const url = await adapter.uploadImage(file, 'steps');

			const command = sendMock.mock.calls[0][0] as PutObjectCommand;
			expect(command.input.Key).toMatch(/^steps\//);
			expect(url).toMatch(/^steps\//);
		});
	});

	describe('deleteImage', () => {
		it('debería extraer la key de la URL y ejecutar DeleteObjectCommand', async () => {
			await adapter.deleteImage('https://cdn.example.com/missions/abc.png');

			expect(sendMock).toHaveBeenCalledTimes(1);
			const command = sendMock.mock.calls[0][0] as DeleteObjectCommand;
			expect(command).toBeInstanceOf(DeleteObjectCommand);
			expect(command.input.Bucket).toBe('luckybet-premios');
			expect(command.input.Key).toBe('missions/abc.png');
		});

		it('debería ser no-op cuando la URL no pertenece al bucket', async () => {
			await adapter.deleteImage('https://otro-cdn.com/missions/abc.png');

			expect(sendMock).not.toHaveBeenCalled();
		});
	});

	describe('replaceImage', () => {
		it('debería subir la nueva imagen y eliminar la anterior', async () => {
			const url = await adapter.replaceImage(
				file,
				'steps',
				'https://cdn.example.com/steps/viejo.png',
			);

			expect(sendMock).toHaveBeenCalledTimes(2);
			const uploadCommand = sendMock.mock.calls[0][0] as PutObjectCommand;
			const deleteCommand = sendMock.mock.calls[1][0] as DeleteObjectCommand;
			expect(uploadCommand).toBeInstanceOf(PutObjectCommand);
			expect(uploadCommand.input.Key).toMatch(/^steps\//);
			expect(deleteCommand).toBeInstanceOf(DeleteObjectCommand);
			expect(deleteCommand.input.Key).toBe('steps/viejo.png');
			expect(url).toMatch(/^steps\//);
		});

		it('debería devolver la nueva URL aunque falle la eliminación de la anterior', async () => {
			sendMock
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(new Error('delete failed'));

			const url = await adapter.replaceImage(
				file,
				'missions',
				'https://cdn.example.com/missions/viejo.png',
			);

			expect(url).toMatch(/^missions\//);
			expect(sendMock).toHaveBeenCalledTimes(2);
		});
	});
});
