### Case CHECK-MODE-OPTIONS-001: 检查选项解析 quick、full 与 verbose 契约
Entry:
- `scripts/check.test.ts > check options resolve quick, full, and verbose profiles`
- `bun test --test-name-pattern="^check options resolve quick, full, and verbose profiles$" ./scripts/check.test.ts`
Contract:
- 未指定档位时使用 quick，`--full` 选择完整档，`--verbose` 可以与任一档位组合。
Proves:
- 选项解析返回预期档位和日志策略。
- 已移除的 `--strict` 不会被静默接受。
