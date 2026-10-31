### Case INVESTIGATION-CANDIDATE-RESOURCE-001: candidate owner resources require direct reference

Tests:
- `test:4d01d5c05e2648882ec030e15e446a16917f0e60c5c71f11d857bc4b5519be56`

Tags:
- `investigation-report`

Contract:
- candidate 自有的版本控制可见资源必须由该 candidate 直接引用；未引用成员使 candidate 的 `resourceReady` 失败，但不阻断无关正式集合检查。

Proves:
- 含额外 owner resource 的 candidate 仍有合法 scaffold/body，却报告 resource readiness attention。
- 默认正式检查不将集合外 candidate 的未就绪资源当作正式集合错误。
