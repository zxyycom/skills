### Case RECORD-SYNC-PREFLIGHT-LOCK-001: 两域同步预检不取得独占写锁

Tests:
- `test:225a9e3610f96e52a1c28dfeff49efd09f0795f294380ebf4bc969c0fd15f207`
- `test:874ff741913484e7cb618cf00493ea020800532e53eb395b16a347918f08caa3`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 全量同步预检零写、不取得独占写锁，正式同步仍要求集合锁。

Proves:
- 真实忙锁下API和CLI预检通过、正式写入拒绝，持久索引和原锁字节均不变。
