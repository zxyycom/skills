### Case INVESTIGATION-STAGE-CLI-USAGE-001: CLI stage-index uses invalid-option exit status without report IDs

Tests:
- `test:1d7cbea084386e5bee818e34243039799aa89a5f7e39eedf4546beaeb25ded4a`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `stage-index` 必须要求至少一个 Investigation ID。

Proves:
- 省略报告 ID 返回退出码 2、stdout 为空、stderr 给出用法诊断且派生 index 字节不变。
