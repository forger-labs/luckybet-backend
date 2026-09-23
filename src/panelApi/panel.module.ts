import { Global, Module } from '@nestjs/common';
import axios from 'axios';

import { PlayersModule } from '@/src/players/players.module';
import { AdminPanelService } from './adapters/driven/adminPanel.service';
import { UserPanelService } from './adapters/driven/userPanel.service';
import { PanelController } from './adapters/driver/luckyPanel.controller';
import { PlayerTokenGuard } from './app/guards/playerToken.guard';
import { PanelApiCore } from './app/panelApiCore';
import {
  AXIOS_ADMIN_PANEL,
  AXIOS_INSTANCE,
  AXIOS_USER_PANEL,
  FOR_ADMIN_PANEL,
  FOR_PANEL_API_CORE,
  FOR_USER_PANEL,
} from './constants';

@Global()
@Module({
  imports: [PlayersModule],
  controllers: [PanelController],
  providers: [
    {
      provide: AXIOS_USER_PANEL,
      useFactory: () => {
        return axios.create({
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 15_000,
        });
      },
    },
    {
      provide: AXIOS_ADMIN_PANEL,
      useFactory: () => {
        return axios.create({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 15_000,
        });
      },
    },
    {
      provide: AXIOS_INSTANCE,
      useExisting: AXIOS_USER_PANEL,
    },
    {
      provide: FOR_ADMIN_PANEL,
      useClass: AdminPanelService,
    },
    {
      provide: FOR_USER_PANEL,
      useClass: UserPanelService,
    },
    {
      provide: FOR_PANEL_API_CORE,
      useClass: PanelApiCore,
    },
    AdminPanelService,
    UserPanelService,
    PanelApiCore,
    PlayerTokenGuard,
  ],
  exports: [
    UserPanelService,
    AdminPanelService,
    PanelApiCore,
    PlayerTokenGuard,
    FOR_ADMIN_PANEL,
    FOR_USER_PANEL,
    FOR_PANEL_API_CORE,
    AXIOS_USER_PANEL,
    AXIOS_ADMIN_PANEL,
    AXIOS_INSTANCE,
  ],
})
export class PanelModule {}
