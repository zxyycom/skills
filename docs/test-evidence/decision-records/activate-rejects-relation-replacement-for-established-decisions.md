### Case DECISION-ACTIVATE-ESTABLISHED-RELATIONS-001: Activate 不修订已建立记录的关系
Entry:
- `tools/decision-records/tests/evolution.test.ts > activate rejects relation replacement for established decisions`
- `bun test --test-name-pattern="^activate rejects relation replacement for established decisions$" ./tools/decision-records/tests/run.ts`
Contract:
- `activate --relation` 与 `activate --clear-relations` 只服务于首次建立候选；已建立记录的关系修订必须通过 evolve 表达。
Proves:
- 对已建立记录提供非空关系覆盖或显式清空都返回关系输入不适用诊断。
- 两种拒绝路径均逐字节保留目标 Markdown 和 decision-index.json。
