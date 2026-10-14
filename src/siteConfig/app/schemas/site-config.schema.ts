import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';
import { zDateHelper } from '../../../shared/swagger/date.schema';

export const siteConfigSchema = z.object({
	id: z.number().int().describe('ID de la configuración'),
	created_at: zDateHelper.describe('Fecha de creación'),
	updated_at: zDateHelper.describe('Fecha de actualización'),
	admin_panel_api_url: z
		.string()
		.min(1, 'La URL de la API de administración es obligatoria')
		.describe('URL de la API del panel de administración'),
	client_panel_api_url: z
		.string()
		.min(1, 'La URL de la API de cliente es obligatoria')
		.describe('URL de la API del panel de cliente'),
	logo_url: z.string().nullable().describe('URL del logotipo del sitio'),
	theme: z
		.string()
		.min(1, 'El tema es obligatorio')
		.default('midnight-harbor')
		.describe('Tema visual del sitio'),
});

export const adminSiteConfigSchema = siteConfigSchema;

export const publicSiteConfigSchema = siteConfigSchema.omit({
	admin_panel_api_url: true,
});

export const createSiteConfigSchema = z.object({
	admin_panel_api_url: z
		.string()
		.min(1, 'La URL de la API de administración es obligatoria')
		.optional(),
	adminPanelApiUrl: z.string().min(1).optional(),
	client_panel_api_url: z
		.string()
		.min(1, 'La URL de la API de cliente es obligatoria')
		.optional(),
	clientPanelApiUrl: z.string().min(1).optional(),
	logo_url: z.string().nullable().optional(),
	logoUrl: z.string().nullable().optional(),
	theme: z.string().min(1).default('midnight-harbor').optional(),
});

export const updateSiteConfigSchema = z.object({
	admin_panel_api_url: z.string().min(1).optional(),
	adminPanelApiUrl: z.string().min(1).optional(),
	client_panel_api_url: z.string().min(1).optional(),
	clientPanelApiUrl: z.string().min(1).optional(),
	logo_url: z.string().nullable().optional(),
	logoUrl: z.string().nullable().optional(),
	theme: z.string().min(1).optional(),
});

export type SiteConfigModel = z.infer<typeof siteConfigSchema>;
export type AdminSiteConfig = z.infer<typeof adminSiteConfigSchema>;
export type PublicSiteConfig = z.infer<typeof publicSiteConfigSchema>;
export type CreateSiteConfigInput = z.infer<typeof createSiteConfigSchema>;
export type UpdateSiteConfigInput = z.infer<typeof updateSiteConfigSchema>;

export const SiteConfigResponseSchema = apiResponseSchema(adminSiteConfigSchema);
export const PublicSiteConfigResponseSchema = apiResponseSchema(publicSiteConfigSchema);
export const AdminSiteConfigResponseSchema = apiResponseSchema(adminSiteConfigSchema);

export class SiteConfigResponseDto extends createZodDto(SiteConfigResponseSchema) {}
export class PublicSiteConfigResponseDto extends createZodDto(
	PublicSiteConfigResponseSchema,
) {}
export class AdminSiteConfigResponseDto extends createZodDto(
	AdminSiteConfigResponseSchema,
) {}
