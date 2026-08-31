### Case GATE-FILE-SELECTION-001: 六项原生 Check 排除历史内容

Entry:
- `scripts/vibe-check.test.ts > native file selections exclude archived Changes and investigation resources`
- `bun test --test-name-pattern="^native file selections exclude archived Changes and investigation resources$" ./scripts/vibe-check.test.ts`

Contract:
- 当前门禁只检查可维护输入；归档 Change 与 Investigation Report 的形成时资源必须同时被六项 Vibe 原生 Check 排除。

Proves:
- 每项原生 Check 的文件选择都包含 `changes/archive/**` 与 `docs/investigations/_resources/**` 排除规则。
