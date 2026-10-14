import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../shared/entities/base.entity';

@Entity('site_configurations')
export class SiteConfig extends BaseEntity {
	@Column({
		type: 'varchar',
		length: 255,
		nullable: false,
		name: 'admin_panel_api_url',
	})
	adminPanelApiUrl!: string;

	@Column({
		type: 'varchar',
		length: 255,
		nullable: false,
		name: 'client_panel_api_url',
	})
	clientPanelApiUrl!: string;

	@Column({
		type: 'varchar',
		length: 500,
		nullable: true,
		name: 'logo_url',
	})
	logoUrl!: string | null;

	@Column({
		type: 'varchar',
		length: 50,
		nullable: false,
		default: 'midnight-harbor',
		name: 'theme',
	})
	theme!: string;
}
