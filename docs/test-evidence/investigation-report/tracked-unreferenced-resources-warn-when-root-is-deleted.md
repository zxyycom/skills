### Case INVESTIGATION-RESOURCE-TRACKED-MISSING-ROOT-001: 删除整个资源根后已跟踪的未引用资源产生 Missing Warning

Entry:
- `tools/investigation-report/tests/resources.test.ts > tracked unreferenced resource members warn when their entire resource root is deleted`
- `bun test --test-name-pattern="^tracked unreferenced resource members warn when their entire resource root is deleted$" ./tools/investigation-report/tests/run.ts`

Contract:
- Git 已跟踪但未被报告引用的资源，即使整个 `_resources` 工作树被删除，也应报告缺失 warning 而不是阻断完整验证。

Proves:
- 删除资源根后，完整验证没有 errors，并返回包含已跟踪资源 ID 与 `does not exist` 原因的 warning。
