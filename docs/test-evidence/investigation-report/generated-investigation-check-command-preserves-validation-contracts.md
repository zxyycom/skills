### Case INVESTIGATION-CLI-CONTRACTS-001: 生成 check 命令保持验证契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation check command preserves validation contracts`
- `bun test --test-name-pattern="^generated investigation check command preserves validation contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 生成调查 CLI 的默认 check 命令必须支持完整与路径过滤验证，并以退出码区分有效和无效报告。
Proves:
- 完整与过滤检查输出稳定，结构错误产生失败诊断和退出码 1。
