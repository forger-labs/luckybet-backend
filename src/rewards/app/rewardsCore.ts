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
import { PlayerRepoService } from '../../players/adapters/driven/PlayerRepo.service';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { FOR_DATABASE_ROOMS } from '../../rooms/app/constants';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
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
    @Inject(PlayerRepoService)
    private readonly playerRepo: ForDatabasePlayers,
    @Inject(FOR_DATABASE_ROOMS)
    private readonly roomRepo: ForDatabaseRooms,
  ) {}

  async createReward(data: {
    userMissionId: number;
    playerId: number;
    coinsAmount: number;
    roomId?: number | null;
    experiencePoints: number;
  }): Promise<MissionRewardBasic> {
    return await this.rewardRepo.createReward(data);
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

    // Obtener jugador y su sala base
    const player = await this.playerRepo.findByUnique({ id: playerId });

    if (!player) {
      throw new BadRequestException(
        'Este jugador no existe en nuestra base de datos',
      );
    }
    const playerIdentifier = player.username;
    const baseRoom = player.room;

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

    let transferredToTarget = false;

    // 1. Si la recompensa tiene una sala especial asignada, transferir al jugador
    if (locked.roomId && this.roomRepo) {
      const targetRoom = await this.roomRepo.findById(locked.roomId);
      if (targetRoom?.isActive) {
        const success = await this.panelApi
          .changePlayerSenior(playerIdentifier, targetRoom.name)
          .catch((err) => {
            this.logger.error(
              `Error al transferir jugador a sala [${targetRoom.name}]:`,
              err,
            );
            return false;
          });

        // Si la transferencia a la sala promocional falla, abortar crédito y marcar TIMEOUT_UNCERTAIN
        if (!success) {
          return await this.rewardRepo.updateStatus(
            locked.id,
            RewardStatus.TIMEOUT_UNCERTAIN,
            {
              errorMessage: `Fallo al transferir a la sala promocional [${targetRoom.name}] antes de acreditar`,
            },
          );
        }
        transferredToTarget = true;
      }
    }

    // 2. Ejecutar acreditación de saldo en LuckyBet
    let mutationResult: {
      success: boolean;
      operationId?: string | null;
      errorMessage?: string;
    } | null = null;
    try {
      mutationResult = await this.panelApi.creditPlayer(
        playerIdentifier,
        locked.coinsAmount,
      );
    } catch (error) {
      // Timeout o error de red en la carga
      this.logger.error(
        `Timeout/Error al acreditar saldo en LuckyBet para reward ${locked.id}:`,
        error,
      );
      return await this.rewardRepo.updateStatus(
        locked.id,
        RewardStatus.TIMEOUT_UNCERTAIN,
        {
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Error desconocido de conexion al acreditar',
        },
      );
    }

    if (!mutationResult.success) {
      this.logger.error(
        `Error reportado por LuckyBet al acreditar fichas: ${mutationResult.errorMessage}`,
      );
      // Regresar al jugador a su sala si fue movido
      if (transferredToTarget && baseRoom) {
        await this.panelApi
          .changePlayerSenior(playerIdentifier, baseRoom.name)
          .catch(() => undefined);
      }
      return await this.rewardRepo.updateStatus(
        locked.id,
        RewardStatus.PENDING,
        {
          errorMessage:
            mutationResult.errorMessage ?? 'Error al acreditar saldo',
        },
      );
    }

    // 3. Retorno obligatorio a la sala base del jugador si fue transferido
    if (transferredToTarget && baseRoom) {
      const returned = await this.panelApi
        .changePlayerSenior(playerIdentifier, baseRoom.name)
        .catch((err) => {
          this.logger.error(
            `Error al regresar al jugador a su sala base [${baseRoom.name}]:`,
            err,
          );
          return false;
        });

      // Si el saldo ya entró pero falló el retorno a la sala base, marcar TIMEOUT_UNCERTAIN para auditoría
      if (!returned) {
        return await this.rewardRepo.updateStatus(
          locked.id,
          RewardStatus.TIMEOUT_UNCERTAIN,
          {
            externalOperationId: mutationResult.operationId ?? null,
            errorMessage: `Fichas acreditadas (Op: ${mutationResult.operationId}) pero fallo el retorno a la sala base [${baseRoom.name}]`,
            claimedAt: new Date(),
          },
        );
      }
    }

    return await this.rewardRepo.updateStatus(locked.id, RewardStatus.CLAIMED, {
      externalOperationId: mutationResult.operationId ?? null,
      claimedAt: new Date(),
    });
  }

  async getPendingRewards(playerId: number): Promise<MissionRewardBasic[]> {
    return await this.rewardRepo.findPendingByPlayer(playerId);
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
    adminId: number,
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

    const player = this.playerRepo
      ? await this.playerRepo.findByUnique({ id: reward.playerId })
      : null;
    const playerIdentifier = player?.username || String(reward.playerId);
    const baseRoom = player?.room;

    if (action === 'RESOLVE_CLAIMED') {
      // Si el saldo ya entró y solo faltaba devolver al jugador a su sala
      if (baseRoom) {
        await this.panelApi
          .changePlayerSenior(playerIdentifier, baseRoom.name)
          .catch(() => undefined);
      }

      return this.rewardRepo.updateStatus(reward.id, RewardStatus.CLAIMED, {
        externalOperationId:
          options?.externalOperationId ?? reward.externalOperationId,
        errorMessage: options?.adminNotes
          ? `Resuelto: ${options.adminNotes}`
          : undefined,
        resolvedByAdminId: adminId,
        claimedAt: new Date(),
      });
    }

    // FORCE_RETRY: Forzar la ejecución hacia LuckyBet con transferencia y retorno
    if (reward.roomId && this.roomRepo) {
      const targetRoom = await this.roomRepo.findById(reward.roomId);
      if (targetRoom?.isActive) {
        await this.panelApi
          .changePlayerSenior(playerIdentifier, targetRoom.name)
          .catch(() => undefined);
      }
    }

    try {
      const mutation = await this.panelApi.creditPlayer(
        playerIdentifier,
        reward.coinsAmount,
      );
      if (mutation.success) {
        // Retornar al jugador a su sala base
        if (baseRoom) {
          await this.panelApi
            .changePlayerSenior(playerIdentifier, baseRoom.name)
            .catch(() => undefined);
        }

        return await this.rewardRepo.updateStatus(
          reward.id,
          RewardStatus.CLAIMED,
          {
            externalOperationId: mutation.operationId ?? null,
            resolvedByAdminId: adminId,
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
