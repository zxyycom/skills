### Case INVESTIGATION-RESOURCE-OWNER-001: owner report must directly reference its own resource

Entry:
- `tools/investigation-report/tests/resources.test.ts > owner report must directly reference its own resource`
- `bun test --test-name-pattern="^owner report must directly reference its own resource$" ./tools/investigation-report/tests/run.ts`

Contract:
- owner report 必须直接引用自己拥有的资源。

Proves:
- 仅 consumer 引用 owner 资源时返回 owner-reference 诊断。
