### Case INVESTIGATION-RESOURCE-INVALID-OWNER-ANCHOR-001: 无效 Owner 主题不能为有效消费者建立资源 Anchor

Entry:
- `tools/investigation-report/tests/resources.test.ts > invalid owner topics cannot anchor resource references from valid consumers`
- `bun test --test-name-pattern="^invalid owner topics cannot anchor resource references from valid consumers$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 owner 主题本身必须通过主题验证，才可作为其他有效消费者主题共享资源的 anchor。

Proves:
- owner 主题无效时，即使该主题列出资源，有效消费者的同一资源引用仍返回要求 owner 主题引用该资源的 error。
