### Case INVESTIGATION-CLI-RELATIONS-001: CLI set-relations prints a human-readable result and rejects JSON output

Tests:
- `test:76ef62a3584c3b166dd16a95c5097a0cbab6840fdce7d2f34e786ad6cb8c0ffe`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `set-relations` 以完整 source 组接收替换，并输出人类可读结果；不提供 JSON 输出契约。

Proves:
- 合法 source 与 relation 组会写入关系，并在 stdout 返回人类可读结果且保持 stderr 为空。
- 随后的 `--json` 调用在参数边界被拒绝，且不会覆盖已写入的 Markdown 关系。
