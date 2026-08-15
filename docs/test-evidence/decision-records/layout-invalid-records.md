### Case DECISION-LAYOUT-INVALID-001: 扫描器拒绝无效物理布局

Entry:
- `tools/decision-records/tests/layout-index.test.ts > scanner rejects status-position mismatches nested paths and duplicate decision IDs`
- `bun test --test-name-pattern="^scanner rejects status-position mismatches nested paths and duplicate decision IDs$" ./tools/decision-records/tests/run.ts`

Contract:
- 扫描器必须同时拒绝状态与物理 sourcePath 不匹配、根目录嵌套目录以及跨位置重复 Decision ID。

Proves:
- 断言三类输入分别产生 status/sourcePath、unsupported nested directory 和 duplicate ID 诊断。
