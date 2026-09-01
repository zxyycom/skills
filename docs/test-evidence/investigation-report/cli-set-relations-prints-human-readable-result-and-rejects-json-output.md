### Case INVESTIGATION-CLI-RELATIONS-001: CLI set-relations prints a human-readable result and rejects JSON output

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI set-relations prints a human-readable result and rejects JSON output`
- `bun test --test-name-pattern="^CLI set-relations prints a human-readable result and rejects JSON output$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口 `set-relations` 以完整 source 组接收替换，并输出人类可读结果；不提供 JSON 输出契约。

Proves:

- 合法 source 与 relation 组会写入关系，并在 stdout 返回人类可读结果且保持 stderr 为空。
- 随后的 `--json` 调用在参数边界被拒绝，且不会覆盖已写入的 Markdown 关系。
