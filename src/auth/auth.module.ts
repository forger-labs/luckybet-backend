import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UserRepoService } from '../users/adapters/driven/UserRepo.service';
import { ForDatabaseUsers } from '../users/ports/driver/ForDatabaseUsers';
import { UsersModule } from '../users/users.module';
import { AuthController } from './adapters/driver/auth.controller';
import { AuthCore } from './app/authCore';
import { JwtGuard } from './app/guards/jwt.guard';
import { RolesGuard } from './app/guards/roles.guard';
import { JwtStrategy } from './app/strategies/jwt.strategy';
import { AUTHCORE_PROVIDER } from './constants';

@Module({
	imports: [
		UsersModule,
		PassportModule.register({ defaultStrategy: 'jwt' }),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.getOrThrow<string>('JWT_SECRET'),
				signOptions: {
					expiresIn: Number(config.getOrThrow<string>('EXPIRES_IN_TOKEN')),
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [
		{
			provide: AUTHCORE_PROVIDER,
			useFactory: (jwtService: JwtService, repo: ForDatabaseUsers) =>
				new AuthCore(jwtService, repo),
			inject: [JwtService, UserRepoService],
		},
		JwtStrategy,
		JwtGuard,
		RolesGuard,
	],
	exports: [JwtGuard, RolesGuard],
})
export class AuthModule {}
