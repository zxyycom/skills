### Case INVESTIGATION-RESOURCE-TRACKED-MISSING-ROOT-001: unreferenced resource members produce warnings without blocking report checks

Entry:
- `tools/investigation-report/tests/resources.test.ts > unreferenced resource members produce warnings without blocking report checks`
- `bun test --test-name-pattern="^unreferenced resource members produce warnings without blocking report checks$" ./tools/investigation-report/tests/run.ts`

Contract:
- 未引用资源成员不会阻断报告检查。

Proves:
- 未引用资源产生 warning 且 errors 为空。
