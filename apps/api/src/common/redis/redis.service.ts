import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * Redis key namespace conventions:
 *
 * Session data (TTL: 24h):
 *   session:{sessionId}:answers    — HASH: { questionId → JSON answer }
 *   session:{sessionId}:timing     — HASH: { questionId → ms spent }
 *   session:{sessionId}:meta       — HASH: { startTime, currentIndex, ... }
 *
 * Auth (TTL: matches JWT refresh TTL):
 *   auth:refresh_blacklist:{tokenHash} — STRING: 'revoked'
 *
 * Leaderboard (no TTL, persistent):
 *   leaderboard:{examId}           — SORTED SET: score → userId
 *
 * Rate limiting (managed by ThrottlerModule):
 *   throttle:* — managed by @nestjs/throttler
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis;

  // TTL constants (in seconds)
  static readonly TTL = {
    SESSION: 60 * 60 * 24,         // 24 hours
    REFRESH_TOKEN: 60 * 60 * 24 * 7, // 7 days
    LEADERBOARD: 0,                 // 0 = no expiry
  } as const;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 5) {
          this.logger.error('Redis connection failed after 5 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('connect', () => this.logger.log('✅ Redis connection established'));
    this.client.on('error', (err) => this.logger.error('Redis error:', err.message));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting...'));
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  // ── Convenience helpers ──────────────────────────────────────────────────

  /** Set a key with optional TTL in seconds */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /** Atomic hash set for session answers */
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /** Get all fields from a hash */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /** Set TTL on a key */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  /** Add to sorted set (leaderboard) */
  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  /** Get top N members from sorted set (highest score first) */
  async zrevrange(key: string, start: number, stop: number, withScores = false) {
    if (withScores) {
      return this.client.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrevrange(key, start, stop);
  }

  /** Get rank of member in sorted set (0-indexed, highest first) */
  async zrevrank(key: string, member: string): Promise<number | null> {
    return this.client.zrevrank(key, member);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
