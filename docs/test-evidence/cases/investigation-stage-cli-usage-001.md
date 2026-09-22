### Case INVESTIGATION-STAGE-CLI-USAGE-001: CLI stage uses invalid-option exit status without report IDs

Tests:
- `test:6b173b35b79ccc6a1af2ac5f838ad6ba5f81c0b6dbf340ec26694033a2d288b9`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `stage` 必须要求至少一个 Investigation ID。

Proves:
- 省略报告 ID 返回退出码 2、stdout 为空、stderr 给出用法诊断且派生 index 字节不变。
