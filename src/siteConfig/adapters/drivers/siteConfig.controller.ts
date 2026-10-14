import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Patch,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { JwtGuard } from '../../../auth/app/guards/jwt.guard';
import { RolesGuard } from '../../../auth/app/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { buildResponse } from '../../../shared/libs/buildResponse';
import type { UploadableFile } from '../../../shared/storage/storage.port';
import { AdminRoles } from '../../../users/app/entities/user.entity';
import { SITE_CONFIG_CORE_PROVIDER } from '../../app/constants';
import {
	AdminSiteConfigResponseDto,
	PublicSiteConfigResponseDto,
} from '../../app/schemas/site-config.schema';
import { UpdateSiteConfigDto } from '../../app/schemas/update-site-config.dto';
import type { ForManageSiteConfig } from '../../ports/drivens/ForManageSiteConfig';

@ApiTags('Site Configuration')
@Controller()
export class SiteConfigController {
	constructor(
		@Inject(SITE_CONFIG_CORE_PROVIDER)
		private readonly siteConfigCore: ForManageSiteConfig,
	) {}

	@Get('site-config')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Obtener configuración pública del sitio',
		description:
			'Retorna la configuración necesaria para el cliente (tema, logo, URL de panel de cliente). Excluye URLs administrativas.',
	})
	@ApiOkResponse({ type: PublicSiteConfigResponseDto })
	async getPublicConfig() {
		const config = await this.siteConfigCore.getPublicConfig();
		return buildResponse(config, 'Configuración del sitio obtenida exitosamente', true);
	}

	@Get('admin/site-config')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Obtener configuración completa del sitio (Admin)',
		description: 'Retorna la configuración global incluyendo URLs de panel admin.',
	})
	@ApiOkResponse({ type: AdminSiteConfigResponseDto })
	async getAdminConfig() {
		const config = await this.siteConfigCore.getAdminConfig();
		return buildResponse(
			config,
			'Configuración administrativa obtenida exitosamente',
			true,
		);
	}

	@Patch('admin/site-config')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Actualizar configuración del sitio (Admin)',
		description: 'Actualiza tema, URLs de paneles de admin/cliente o URL de logo.',
	})
	@ApiOkResponse({ type: AdminSiteConfigResponseDto })
	async updateConfig(@Body() dto: UpdateSiteConfigDto) {
		const updated = await this.siteConfigCore.updateConfig(dto);
		return buildResponse(updated, 'Configuración actualizada exitosamente', true);
	}

	@Post('admin/site-config/logo')
	@ApiCookieAuth()
	@UseGuards(JwtGuard, RolesGuard)
	@Roles(AdminRoles.SUPER_ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Subir nuevo logotipo del sitio (Admin)',
		description:
			'Sube una imagen mediante multipart/form-data y actualiza el logoUrl del sitio.',
	})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['file'],
			properties: {
				file: { type: 'string', format: 'binary' },
			},
		},
	})
	@ApiOkResponse({ type: AdminSiteConfigResponseDto })
	async uploadLogo(@Req() req: FastifyRequest) {
		const file = (req.body as { file?: UploadableFile } | undefined)?.file;
		if (!file?.buffer) {
			throw new BadRequestException('El archivo de imagen es requerido');
		}

		const updated = await this.siteConfigCore.updateLogo(file);
		return buildResponse(updated, 'Logotipo actualizado exitosamente', true);
	}
}
