### Case INVESTIGATION-CLI-STAGE-JSON-001: CLI stage rejects JSON output

Tests:
- `test:51dcb6bbe09de57bd33c960d5b0cbae3ca502af26e6eabafa36356325fcf824b`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口不为 `stage` 提供 JSON 输出协议。

Proves:
- 传入 `--json` 返回退出码 2、stdout 为空、stderr 给出未知选项诊断，且派生 index 字节不变。
