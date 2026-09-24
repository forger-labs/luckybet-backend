import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { FOR_PANEL_API_CORE } from '../../panelApi/constants';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForManageRewards } from '../ports/driven/ForManageRewards';
import type { ForDatabaseMissionRewards } from '../ports/driver/ForDatabaseMissionRewards';
import { FOR_DATABASE_MISSION_REWARDS } from './constants';
import type { MissionRewardBasic } from './dto/reward.schema';
import { RewardAction, RewardStatus } from './enums';

@Injectable()
export class RewardsCore implements ForManageRewards {
  private readonly logger = new Logger(RewardsCore.name);

  constructor(
    @Inject(FOR_DATABASE_MISSION_REWARDS)
    private readonly rewardRepo: ForDatabaseMissionRewards,
    @Inject(FOR_PANEL_API_CORE)
    private readonly panelApi: ForPanelApiCore,
  ) {}

  createReward(data: {
    userMissionId: number;
    playerId: number;
    coinsAmount: number;
    experiencePoints: number;
  }): Promise<MissionRewardBasic> {
    return this.rewardRepo.createReward(data);
  }

  async claimReward(
    userMissionId: number,
    playerId: number,
  ): Promise<MissionRewardBasic> {
    const existing = await this.rewardRepo.findByUserMissionId(userMissionId);
    if (!existing) {
      throw new NotFoundException('Recompensa no encontrada para esta mision');
    }

    if (existing.playerId !== playerId) {
      throw new ForbiddenException(
        'No tienes permiso para reclamar esta recompensa',
      );
    }

    if (existing.status === RewardStatus.CLAIMED) {
      throw new BadRequestException('Esta recompensa ya fue reclamada');
    }

    if (existing.status === RewardStatus.TIMEOUT_UNCERTAIN) {
      throw new BadRequestException(
        'Este reclamo se encuentra en proceso de verificacion por el equipo de administracion',
      );
    }

    // Adquirir bloqueo atómico en PostgreSQL cambiando a PROCESSING
    const locked = await this.rewardRepo.acquireProcessingLock(userMissionId, [
      RewardStatus.PENDING,
    ]);
    if (!locked) {
      throw new ConflictException(
        'La recompensa ya esta siendo procesada o ya fue cobrada',
      );
    }

    // Si no otorga monedas (solo exp), marcar directamente como reclamado
    if (locked.coinsAmount <= 0) {
      return this.rewardRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
        claimedAt: new Date(),
      });
    }

    // Ejecutar llamada hacia el panel externo de LuckyBet
    try {
      const mutation = await this.panelApi.creditPlayer(
        playerId,
        locked.coinsAmount,
      );
      if (mutation.success) {
        return await this.rewardRepo.updateStatus(
          locked.id,
          RewardStatus.CLAIMED,
          {
            externalOperationId: mutation.operationId ?? null,
            claimedAt: new Date(),
          },
        );
      }

      // Si devolvió success: false de forma sincrónica y limpia
      this.logger.error(
        `Error en panel LuckyBet al acreditar fichas: ${mutation.errorMessage}`,
      );
      return await this.rewardRepo.updateStatus(
        locked.id,
        RewardStatus.PENDING,
        {
          errorMessage: mutation.errorMessage ?? 'Error al acreditar saldo',
        },
      );
    } catch (error) {
      // En caso de timeout, corte de socket o excepción HTTP de red
      this.logger.error(
        `Fallo de conexion o timeout con LuckyBet para reward ${locked.id}:`,
        error,
      );
      return await this.rewardRepo.updateStatus(
        locked.id,
        RewardStatus.TIMEOUT_UNCERTAIN,
        {
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Error desconocido de conexion',
        },
      );
    }
  }

  getPendingRewards(playerId: number): Promise<MissionRewardBasic[]> {
    return this.rewardRepo.findPendingByPlayer(playerId);
  }

  async getUncertainRewards(params?: {
    take?: number;
    skip?: number;
  }): Promise<{
    rewards: MissionRewardBasic[];
    total: number;
    limit: number;
    skip: number;
  }> {
    const [rewards, total] = await this.rewardRepo.findUncertainRewards(params);
    return {
      rewards,
      total,
      limit: params?.take ?? 50,
      skip: params?.skip ?? 0,
    };
  }

  async resolveUncertainReward(
    rewardId: number,
    action: RewardAction,
    options?: { externalOperationId?: string; adminNotes?: string },
  ): Promise<MissionRewardBasic> {
    const reward = await this.rewardRepo.findById(rewardId);
    if (!reward) {
      throw new NotFoundException('Recompensa no encontrada');
    }

    if (reward.status !== RewardStatus.TIMEOUT_UNCERTAIN) {
      throw new BadRequestException(
        'Solo se pueden resolver recompensas en estado TIMEOUT_UNCERTAIN',
      );
    }

    if (action === 'RESOLVE_CLAIMED') {
      return this.rewardRepo.updateStatus(reward.id, RewardStatus.CLAIMED, {
        externalOperationId:
          options?.externalOperationId ?? reward.externalOperationId,
        errorMessage: options?.adminNotes
          ? `Resuelto: ${options.adminNotes}`
          : undefined,
        claimedAt: new Date(),
      });
    }

    // FORCE_RETRY: Forzar la ejecución hacia LuckyBet
    try {
      const mutation = await this.panelApi.creditPlayer(
        reward.playerId,
        reward.coinsAmount,
      );
      if (mutation.success) {
        return await this.rewardRepo.updateStatus(
          reward.id,
          RewardStatus.CLAIMED,
          {
            externalOperationId: mutation.operationId ?? null,
            claimedAt: new Date(),
          },
        );
      }
      throw new BadRequestException(
        `Fallo el reintento en LuckyBet: ${mutation.errorMessage}`,
      );
    } catch (error) {
      this.logger.error(
        `Error forzando reintento de reward ${reward.id}:`,
        error,
      );
      throw new BadRequestException(
        `No se pudo forzar el credito en LuckyBet: ${error instanceof Error ? error.message : 'Error de conexion'}`,
      );
    }
  }
}
