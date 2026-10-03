import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [OtpService, AuthService, TokensService],
  exports: [JwtModule],
})
export class AuthModule {}
