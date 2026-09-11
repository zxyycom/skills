### Case INVESTIGATION-DISTRIBUTION-SMOKE-001: generated Investigation Report CLI starts under Node with argv and stdout protocol

Tests:
- `test:0994a4f0ad24c3ca61e90b408f4f93d3b4d4289ad76cab722c77268e93976d1f`

Tags:
- `investigation-report`

Contract:
- 已分发的 Investigation Report ESM 必须可由真实 Node 以 argv 启动，并保留成功输出与退出状态。

Proves:
- 真实 Node 调用生成 CLI 的 `check` 成功、stderr 为空，并在 stdout 输出当前完整 index 的检查计数。
- 真实 Node 调用生成 CLI 的 `publish --help` 成功，并输出选择性 candidate publish 的 `--preflight` 用法。
