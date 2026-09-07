### Case DECISION-CANDIDATE-LOCKED-READINESS-001: 正式生命周期在集合锁内重读候选 readiness

Tests:
- `test:b9615bc6682a260ff9a0e038661c9a247c47f668516787b62f640500c6d286b4`

Tags:
- `decision-records`

Contract:
- 非 preflight 的候选建立在取得集合锁后必须重扫并重新准备，不能沿用锁前的 body readiness。

Proves:
- 测试在锁已取得后将 body-ready candidate 变回空固定章节。
- 正式 activate 拒绝该 candidate，且不生成正式索引。
