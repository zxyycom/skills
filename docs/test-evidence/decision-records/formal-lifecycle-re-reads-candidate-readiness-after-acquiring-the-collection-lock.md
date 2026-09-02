### Case DECISION-CANDIDATE-LOCKED-READINESS-001: 正式生命周期在集合锁内重读候选 readiness

Entry:
- `tools/decision-records/tests/candidate-scaffold.test.ts > formal lifecycle re-reads candidate readiness after acquiring the collection lock`
- `bun test --test-name-pattern="^formal lifecycle re-reads candidate readiness after acquiring the collection lock$" ./tools/decision-records/tests/run.ts`

Contract:
- 非 preflight 的候选建立在取得集合锁后必须重扫并重新准备，不能沿用锁前的 body readiness。

Proves:
- 测试在锁已取得后将 body-ready candidate 变回空固定章节。
- 正式 activate 拒绝该 candidate，且不生成正式索引。
