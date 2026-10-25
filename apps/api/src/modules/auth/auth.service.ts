import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const FRONTEND = () =>
  (process.env.FRONTEND_URL || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email already registered');
    }

    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isEmailVerified: false,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    if (user.email) {
      await this.sendEmailVerification(user.id, user.email, user.firstName);
    }

    const tokens = await this.issueTokens(user.id);

    return {
      user,
      ...tokens,
      message: user.email
        ? 'Account created. Please check your email to verify your address.'
        : 'Account created.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' }, isActive: true },
    });

    // Always same response (no email enumeration)
    const generic = {
      ok: true,
      message: 'If that email is registered, you will receive a reset link shortly.',
    };

    if (!user || !user.email) return generic;

    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt,
      },
    });

    const link = `${FRONTEND()}/reset-password?token=${raw}`;
    await this.mail.send(
      user.email,
      'Reset your Retail OS password',
      `Hi ${user.firstName},\n\nReset your password using this link (valid 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
    );

    const dev =
      process.env.NODE_ENV !== 'production' || process.env.AUTH_DEV_RETURN_TOKEN === 'true';
    return dev ? { ...generic, devToken: raw, devLink: link } : generic;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || newPassword.length < 8) {
      throw new BadRequestException('Invalid token or password too short');
    }
    const tokenHash = this.hashToken(token);
    const row = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) throw new BadRequestException('Invalid or expired reset link');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Password updated. You can sign in now.' };
  }

  async sendEmailVerification(userId: string, email: string, firstName: string) {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.authToken.create({
      data: { userId, type: 'EMAIL_VERIFY', tokenHash, expiresAt },
    });

    const link = `${FRONTEND()}/verify-email?token=${raw}`;
    await this.mail.send(
      email,
      'Verify your Retail OS email',
      `Hi ${firstName},\n\nPlease verify your email:\n${link}\n\nThis link expires in 24 hours.`,
    );

    return {
      ok: true,
      ...(process.env.NODE_ENV !== 'production' || process.env.AUTH_DEV_RETURN_TOKEN === 'true'
        ? { devToken: raw, devLink: link }
        : {}),
    };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) throw new BadRequestException('No email on this account');
    if (user.isEmailVerified) return { ok: true, message: 'Already verified' };
    return this.sendEmailVerification(user.id, user.email, user.firstName);
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const row = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: 'EMAIL_VERIFY',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) throw new BadRequestException('Invalid or expired verification link');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.authToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Email verified successfully' };
  }

  /**
   * Google Sign-In: frontend sends Google ID token; we verify with Google and issue our JWT.
   */
  async loginWithGoogle(idToken: string) {
    if (!idToken) throw new BadRequestException('Missing Google token');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const payload: any = await res.json();
    if (clientId && payload.aud !== clientId) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email = String(payload.email || '').toLowerCase();
    const googleId = String(payload.sub);
    const firstName =
      payload.given_name || String(payload.name || 'User').split(' ')[0] || 'User';
    const lastName = payload.family_name || null;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, email ? { email } : undefined].filter(Boolean) as any,
      },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId,
          isEmailVerified: true,
          lastLoginAt: new Date(),
          ...(user.firstName ? {} : { firstName }),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          firstName,
          lastName,
          isEmailVerified: true,
          passwordHash: null,
          lastLoginAt: new Date(),
        },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('Account is disabled');

    const tokens = await this.issueTokens(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.userId);
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async issueTokens(userId: string) {
    const payload = { sub: userId };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
