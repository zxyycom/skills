### Case INVESTIGATION-GENERATED-METADATA-001: CLI set-relations parses source groups and reports JSON result

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI set-relations parses source groups and reports JSON result`
- `bun test --test-name-pattern="^CLI set-relations parses source groups and reports JSON result$" ./tools/investigation-report/tests/run.ts`

Contract:

- 分发 CLI `set-relations` 以完整 source 组接收替换，并输出结构化 JSON 成功结果。

Proves:

- 合法 source 与 relation 组成功、stderr 为空，stdout JSON 精确列出变更及 source；对应 Markdown 写入关系。
