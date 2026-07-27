### Case CHECK-MODE-OPTIONS-001: 检查模式只接受 warning 与 strict 契约
Entry:
- `scripts/check.test.ts > check mode resolves warning and strict options`
- `bun test --test-name-pattern="^check mode resolves warning and strict options$" ./scripts/check.test.ts`
Contract:
- 未指定模式时使用 warnings，`--strict` 启用 strict，未知选项必须被拒绝。
Proves:
- 模式解析不会接受未声明的命令行选项。
