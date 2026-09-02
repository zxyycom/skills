### Case INVESTIGATION-CANDIDATE-RESOURCE-001: candidate owner resources require direct reference

Entry:

- `tools/investigation-report/tests/candidate.test.ts > candidate readiness requires every visible candidate-owned resource to have a direct owner reference`
- `bun test --test-name-pattern="^candidate readiness requires every visible candidate-owned resource to have a direct owner reference$" ./tools/investigation-report/tests/run.ts`

Contract:

- candidate 自有的版本控制可见资源必须由该 candidate 直接引用；未引用成员使 candidate 的 `resourceReady` 失败，但不阻断无关正式集合检查。

Proves:

- 含额外 owner resource 的 candidate 仍有合法 scaffold/body，却报告 resource readiness attention。
- 默认正式检查不将集合外 candidate 的未就绪资源当作正式集合错误。
