import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';

@Module({
  controllers: [AuthController],
  providers: [OtpService, AuthService],
})
export class AuthModule {}
