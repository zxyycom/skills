### Case RECORD-SYNC-PREFLIGHT-LOCK-001: 两域同步预检不取得独占写锁

Tests:
- `test:0493fedd54286314a159187b91b84fe806c1851b6aa54828abffc76da4eea212`
- `test:1d2614aca920c357c00c82410d4f0c47c636ef69ff7f3971fcb25e81ba3193ba`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 全量同步预检零写、不取得独占写锁，正式同步仍要求集合锁。

Proves:
- 真实忙锁下API和CLI预检通过、正式写入拒绝，持久索引和原锁字节均不变。
