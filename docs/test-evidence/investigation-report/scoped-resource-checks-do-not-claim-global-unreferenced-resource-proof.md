### Case INVESTIGATION-RESOURCE-SCOPE-001: scoped resource checks do not claim global unreferenced resource proof

Entry:
- `tools/investigation-report/tests/resources.test.ts > scoped resource checks do not claim global unreferenced resource proof`
- `bun test --test-name-pattern="^scoped resource checks do not claim global unreferenced resource proof$" ./tools/investigation-report/tests/run.ts`

Contract:
- scoped resource validation 不声明完成全局未引用资源与索引证明。

Proves:
- 按 ID 校验时 `indexChecked` 为 false。
