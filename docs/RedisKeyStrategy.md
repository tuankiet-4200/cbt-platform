# Redis Key Namespace Strategy v1.0

> **Status:** APPROVED ✅  
> **Sprint:** 1.1

## Conventions

- Dấu phân cách: `:` (colon)
- Case: `snake_case` cho segment
- TTL: Luôn đặt TTL, không để key sống mãi mãi (trừ leaderboard)

---

## Key Schemas

### Session Answers (Write Buffer)
```
session:{sessionId}:answers   → HASH
  Field: {questionId}
  Value: JSON string của answerJson
  TTL: 86400 (24h)
  
session:{sessionId}:timing    → HASH
  Field: {questionId}
  Value: milliseconds spent (integer string)
  TTL: 86400 (24h)

session:{sessionId}:meta      → HASH
  Field: currentIndex (số câu đang làm)
  Field: lastSyncAt   (ISO timestamp)
  Field: flagged      (JSON array of question indices)
  TTL: 86400 (24h)
```

### Auth Token Management
```
auth:refresh_blacklist:{hashedToken} → STRING
  Value: 'revoked'
  TTL: Bằng expiry của refresh token (604800 = 7 ngày)
```

### Leaderboard
```
leaderboard:{examId}           → SORTED SET
  Member: {userId}
  Score: totalScore (float)
  TTL: Không set (persistent)
```

### Rate Limiting (managed by @nestjs/throttler)
```
throttle:{ip}:{endpoint}       → STRING (counter)
  TTL: Managed by ThrottlerModule
```

### Idempotency Keys (Submit protection)
```
idempotency:{sessionId}:submit → STRING
  Value: 'submitted'
  TTL: 3600 (1 giờ)
```

---

## Memory Estimation

Với 500 concurrent users, mỗi user có session ~150 câu:
- Answers hash: 500 × 150 × ~100 bytes = ~7.5 MB
- Timing hash: 500 × 150 × ~20 bytes = ~1.5 MB
- Meta hash: 500 × ~200 bytes = ~100 KB
- **Total estimate: ~10 MB** (rất nhỏ so với Redis maxmemory=256MB)

---

## Pipeline Writes

Khi gọi `POST /sessions/:id/sync`, dùng Redis pipeline để giảm round-trips:
```javascript
const pipeline = redis.client.pipeline();
pipeline.hset(`session:${id}:answers`, questionId, JSON.stringify(answer));
pipeline.hset(`session:${id}:timing`, questionId, String(timeSpent));
pipeline.expire(`session:${id}:answers`, RedisService.TTL.SESSION);
pipeline.expire(`session:${id}:timing`, RedisService.TTL.SESSION);
await pipeline.exec();
```
