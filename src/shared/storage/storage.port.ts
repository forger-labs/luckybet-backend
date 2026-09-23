export type StorageFolder = 'missions' | 'steps' | 'levels';
export type MissionImageFolder = StorageFolder;

export type UploadableFile = {
	buffer: Buffer;
	filename: string;
	mimetype: string;
};

export interface StorageService {
	buildPublicUrl(key: string): string;

	uploadImage(file: UploadableFile, folder: StorageFolder): Promise<string>;

	replaceImage(
		file: UploadableFile,
		folder: StorageFolder,
		existingUrl: string,
	): Promise<string>;

	deleteImage(url: string): Promise<void>;
}
