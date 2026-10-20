### Case INVESTIGATION-CLI-STAGE-JSON-001: CLI stage rejects JSON output

Tests:
- `test:51dcb6bbe09de57bd33c960d5b0cbae3ca502af26e6eabafa36356325fcf824b`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口不为 `stage` 提供 JSON 输出协议。

Proves:
- 同进程源码 CLI 在空根接收 `--json` 时返回退出码 2、stdout 为空、stderr 给出未知选项诊断，根目录仍为空。
