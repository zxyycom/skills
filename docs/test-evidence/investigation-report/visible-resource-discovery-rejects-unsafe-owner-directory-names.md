### Case INVESTIGATION-RESOURCE-INVALID-OWNER-WARNING-001: visible resource discovery rejects unsafe owner directory names

Entry:
- `tools/investigation-report/tests/resources.test.ts > visible resource discovery rejects unsafe owner directory names`
- `bun test --test-name-pattern="^visible resource discovery rejects unsafe owner directory names$" ./tools/investigation-report/tests/run.ts`

Contract:
- 可见资源发现拒绝不安全的 owner 目录名。

Proves:
- 不安全 owner 目录产生 warning。
