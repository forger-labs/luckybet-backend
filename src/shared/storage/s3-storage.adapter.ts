import { randomUUID } from 'node:crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StorageFolder, StorageService, UploadableFile } from './storage.port';

const STORAGE_CONFIG_KEYS = {
	endpoint: 'STORAGE_ENDPOINT',
	region: 'STORAGE_REGION',
	accessKeyId: 'STORAGE_ACCESS_KEY_ID',
	secretAccessKey: 'STORAGE_ACCESS_KEY_SECRET',
	bucket: 'STORAGE_BUCKET',
	publicBaseUrl: 'STORAGE_PUBLIC_URL',
	legacyAccountId: 'CL_ACC_ID',
	legacyAccessKeyId: 'CL_ACCESS_KEY_ID',
	legacySecretAccessKey: 'CL_ACCESS_KEY_SC',
} as const;

const MAX_KEY_FILENAME_LENGTH = 100;

@Injectable()
export class S3StorageAdapter implements StorageService {
	private readonly client: S3Client;
	private readonly bucket: string;
	private readonly publicBaseUrl: string;
	private readonly logger = new Logger(S3StorageAdapter.name);

	constructor(private readonly config: ConfigService) {
		const accountId = this.config.get<string>(STORAGE_CONFIG_KEYS.legacyAccountId);
		const endpoint =
			this.config.get<string>(STORAGE_CONFIG_KEYS.endpoint) ??
			`https://${accountId}.r2.cloudflarestorage.com`;
		const region = this.config.get<string>(STORAGE_CONFIG_KEYS.region, 'auto');
		const accessKeyId =
			this.config.get<string>(STORAGE_CONFIG_KEYS.accessKeyId) ??
			this.config.get<string>(STORAGE_CONFIG_KEYS.legacyAccessKeyId) ??
			'';
		const secretAccessKey =
			this.config.get<string>(STORAGE_CONFIG_KEYS.secretAccessKey) ??
			this.config.get<string>(STORAGE_CONFIG_KEYS.legacySecretAccessKey) ??
			'';

		this.bucket = this.config.get<string>(STORAGE_CONFIG_KEYS.bucket, 'luckybet-premios');
		this.publicBaseUrl = (
			this.config.get<string>(STORAGE_CONFIG_KEYS.publicBaseUrl) ??
			`${endpoint}/${this.bucket}`
		).replace(/\/+$/, '');

		this.client = new S3Client({
			endpoint,
			region,
			credentials: { accessKeyId, secretAccessKey },
		});
	}

	buildPublicUrl(key: string) {
		return `${this.publicBaseUrl}/${key}`;
	}

	async uploadImage(file: UploadableFile, folder: StorageFolder): Promise<string> {
		const key = this.buildKey(folder, file.filename);
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: file.buffer,
				ContentType: file.mimetype,
			}),
		);
		// we should not store the public URL in the database, instead we should store the key and generate the URL when needed
		return key;
	}

	async replaceImage(
		file: UploadableFile,
		folder: StorageFolder,
		existingUrl: string,
	): Promise<string> {
		const newUrl = await this.uploadImage(file, folder);
		if (existingUrl) {
			try {
				await this.deleteImage(existingUrl);
			} catch (error) {
				this.logger.warn(`No se pudo eliminar la imagen anterior: ${existingUrl}`, error);
			}
		}
		return newUrl;
	}

	async deleteImage(url: string): Promise<void> {
		const key = this.extractKeyFromUrl(url);
		if (!key) {
			this.logger.warn(
				`La URL no pertenece a este bucket, se omite la eliminacion: ${url}`,
			);
			return;
		}
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}

	private buildKey(folder: StorageFolder, filename: string): string {
		const sanitized = filename
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, MAX_KEY_FILENAME_LENGTH);
		const safeName = sanitized || 'image';
		return `${folder}/${randomUUID()}-${safeName}`;
	}

	private extractKeyFromUrl(url: string): string | null {
		const base = this.publicBaseUrl.replace(/\/+$/, '');
		if (!url.startsWith(`${base}/`)) {
			return null;
		}
		return url.slice(base.length).replace(/^\/+/, '');
	}
}
