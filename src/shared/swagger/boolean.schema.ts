import z from 'zod';

export const zBooleanQuery = z
	.union([z.boolean(), z.enum(['true', 'false'])])
	.transform(val => (typeof val === 'boolean' ? val : val === 'true'))
	.describe('Boolean en string');
