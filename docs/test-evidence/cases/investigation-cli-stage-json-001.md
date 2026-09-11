### Case INVESTIGATION-CLI-STAGE-JSON-001: CLI stage-index rejects JSON output

Tests:
- `test:eb8092fc3b206dd381468c8ed13404e45b847ef46c439eed73df1e421c40d39a`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 不为 `stage-index` 提供 JSON 输出协议。

Proves:
- 传入 `--json` 返回退出码 2、stdout 为空、stderr 给出未知选项诊断，且派生 index 字节不变。
