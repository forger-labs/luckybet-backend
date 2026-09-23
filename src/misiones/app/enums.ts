export enum MissionType {
	DAILY = 'DAILY',
	WEEKLY = 'WEEKLY',
	FIXED = 'FIXED',
}

export enum MissionStatus {
	INACTIVE = 'INACTIVE',
	ACTIVE = 'ACTIVE',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED',
}

export enum StepType {
	IMAGE = 'IMAGE',
	TEXT = 'TEXT',
}

export enum StepStatus {
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED',
}

export enum UserMissionStatus {
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	EXPIRED = 'EXPIRED',
	CANCELLED = 'CANCELLED',
}
