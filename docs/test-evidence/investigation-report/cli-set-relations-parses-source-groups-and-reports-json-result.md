### Case INVESTIGATION-GENERATED-METADATA-001: CLI set-relations parses source groups and reports JSON result

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI set-relations parses source groups and reports JSON result`
- `bun test --test-name-pattern="^CLI set-relations parses source groups and reports JSON result$" ./tools/investigation-report/tests/run.ts`

Contract:
- `set-relations` 必须以完整 source 组接收关系替换，并支持结构化 JSON 成功结果。

Proves:
- 合法 source 与 relation 组返回成功。
- 没有 source 组的关系参数以用法错误退出。
