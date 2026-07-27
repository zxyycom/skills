### Case TEST-EVIDENCE-TOPICS-SCHEMA-001: Topic 表拒绝不合法定义
Entry:
- `tools/test-evidence/tests/run.ts > topic tables reject missing, malformed, unknown, duplicate, unsorted, and invalid definitions`
- `bun test --test-name-pattern="^topic tables reject missing, malformed, unknown, duplicate, unsorted, and invalid definitions$" ./tools/test-evidence/tests/run.ts`
Contract:
- Topic 表必须符合固定 Schema，topic ID 唯一且排序，描述长度按 Unicode code point 计数。
Proves:
- 缺失、无效 JSON、未知字段、重复、乱序、非法值及越界描述均被拒绝，200 个 Unicode code point 的描述被接受。
