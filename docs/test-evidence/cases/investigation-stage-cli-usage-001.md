### Case INVESTIGATION-STAGE-CLI-USAGE-001: CLI stage uses invalid-option exit status without report IDs

Tests:
- `test:528026351e7ada22aa0948ed29153c92e2bde3b668f10016db848aa51ed24902`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `stage` 必须要求至少一个 Investigation ID。

Proves:
- 同进程源码 CLI 在空根省略报告 ID 时返回退出码 2、stdout 为空、stderr 给出用法诊断，根目录仍为空。
