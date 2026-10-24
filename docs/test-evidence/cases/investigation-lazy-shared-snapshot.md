### Case INVESTIGATION-LAZY-SNAPSHOT-001: 同一快照的校验筛选与追踪共用一张图

Tests:
- `test:f767e7585891ccb9cef3a3c8f2bc02513857b54b72e1d6e133b59c89eff66089`

Tags:
- `investigation-report`

Contract:
- 同一不可变投影内的完整图校验、type-only/目标筛选与 trace 共用首次按需构建的关系图，不改写输入。

Proves:
- 完整校验、type-only/双向筛选与 trace 返回准确成员及摘要，连续读取图引用相同，输入 entries 的 JSON 字节表示不变。
