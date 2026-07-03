import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    const [dbStatus, redisStatus] = await Promise.allSettled([
      this.prismaService.$queryRaw`SELECT 1`,
      this.redisService.ping(),
    ]);

    return {
      status: 'ok',
      services: {
        database:
          dbStatus.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        redis:
          redisStatus.status === 'fulfilled' &&
          (redisStatus.value as string) === 'PONG'
            ? 'healthy'
            : 'unhealthy',
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

