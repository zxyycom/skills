### Case INVESTIGATION-CLI-STAGE-JSON-001: CLI stage-index rejects JSON output

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI stage-index rejects JSON output`
- `bun test --test-name-pattern="^CLI stage-index rejects JSON output$" ./tools/investigation-report/tests/run.ts`

Contract:
- 直接调用的源码 CLI 入口 不为 `stage-index` 提供 JSON 输出协议。

Proves:
- 传入 `--json` 返回退出码 2、stdout 为空、stderr 给出未知选项诊断，且派生 index 字节不变。
