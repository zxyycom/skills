### Case DECISION-ID-RELATION-001: 关系跨根目录和归档解析

Entry:
- `tools/decision-records/tests/lifecycle-relations.test.ts > relations resolve stable IDs across active and archived locations`
- `bun test --test-name-pattern="^relations resolve stable IDs across active and archived locations$" ./tools/decision-records/tests/run.ts`

Contract:
- 关系 target 使用稳定 ID，不依赖 root/archive 物理位置，并能跨两种位置解析。

Proves:
- 激活 candidate 后原 active 归档，索引保留 candidate 到该 ID 的 relation。
