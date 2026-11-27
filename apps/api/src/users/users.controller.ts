import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Envelope, ok } from '../common/envelope.js';
import { UsersService, type UserProfileResponse } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('me')
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Envelope<UserProfileResponse>> {
    return ok(await this.users.getProfile(user.id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name?: unknown; ageBand?: unknown },
  ): Promise<Envelope<UserProfileResponse>> {
    return ok(await this.users.updateProfile(user.id, body ?? {}));
  }

  @Post('me/consent')
  async grantConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      consentType?: unknown;
      guardianName?: unknown;
      guardianPhone?: unknown;
      captureMethod?: unknown;
    },
  ) {
    return ok(await this.users.grantConsent(user.id, body ?? {}));
  }

  @Get('me/consent')
  async getConsent(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.users.getConsentStatus(user.id));
  }

  @Delete('me/consent/:type')
  async revokeConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
  ) {
    return ok(await this.users.revokeConsent(user.id, type));
  }

  @Get('me/notification-preferences')
  async getNotificationPreferences(@CurrentUser() user: AuthenticatedUser) {
    return ok(await this.users.getNotificationPreferences(user.id));
  }

  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { preferences?: unknown },
  ) {
    return ok(
      await this.users.updateNotificationPreferences(
        user.id,
        body?.preferences ?? body,
      ),
    );
  }

  @Delete('me')
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { code?: unknown },
  ) {
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException(
        'Enter the 6-digit OTP code to confirm account deletion.',
      );
    }
    return ok(await this.users.requestAccountDeletion(user.id, code));
  }
}
