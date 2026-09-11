### Case DECISION-CANDIDATE-LOCKED-READINESS-001: 正式生命周期在集合锁内重读候选 readiness

Tests:
- `test:3390034807893c7db1bb9c91f84a5613e6136189a9a1388dc29b1039274b0aac`

Tags:
- `decision-records`

Contract:
- 非 preflight 的候选建立在取得集合锁后必须重扫并重新准备，不能沿用锁前的 body readiness。

Proves:
- 测试在锁已取得后将 body-ready candidate 变回空固定章节。
- 正式 activate 拒绝该 candidate，且不生成正式索引。
