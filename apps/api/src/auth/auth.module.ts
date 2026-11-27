import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { RolesGuard } from './roles.guard.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [OtpService, AuthService, TokensService, AuthGuard, RolesGuard],
  exports: [JwtModule, AuthGuard, RolesGuard, OtpService, TokensService],
})
export class AuthModule {}
