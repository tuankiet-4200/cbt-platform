import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { CookieOptions } from 'express';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const COOKIE_NAME = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.register(dto, this.meta(req));
    this.setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto, this.meta(req));
    this.setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.refresh(this.readRefreshToken(req), this.meta(req));
    this.setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    return { user: session.user, accessToken: session.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(this.readRefreshToken(req));
    res.clearCookie(COOKIE_NAME, this.refreshCookieOptions());
    return result;
  }

  private setRefreshCookie(res: Response, token: string, expires: Date) {
    res.cookie(COOKIE_NAME, token, {
      ...this.refreshCookieOptions(),
      expires,
    });
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth',
    };
  }

  private readRefreshToken(req: Request) {
    return this.parseCookies(req.headers.cookie ?? '')[COOKIE_NAME];
  }

  private parseCookies(header: string) {
    return header.split(';').reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.trim().split('=');
      if (key) acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
  }

  private meta(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
