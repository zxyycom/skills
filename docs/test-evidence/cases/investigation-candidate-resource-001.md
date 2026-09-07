### Case INVESTIGATION-CANDIDATE-RESOURCE-001: candidate owner resources require direct reference

Tests:
- `test:b7a695fed827a67fca39de06bbdedcd3b0aa531cf3da16db04855b2e860eb36c`

Tags:
- `investigation-report`

Contract:
- candidate 自有的版本控制可见资源必须由该 candidate 直接引用；未引用成员使 candidate 的 `resourceReady` 失败，但不阻断无关正式集合检查。

Proves:
- 含额外 owner resource 的 candidate 仍有合法 scaffold/body，却报告 resource readiness attention。
- 默认正式检查不将集合外 candidate 的未就绪资源当作正式集合错误。
