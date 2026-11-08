### Case DECISION-EVOLVE-DUPLICATE-RELATION-TARGET-001: 关系覆盖拒绝重复目标

Tests:
- `test:0eb416053745392aa788afdaf7afae9ca3f98c37557502cfd1b5e4cf62c6e2e3`

Tags:
- `decision-records`

Contract:
- 完整关系覆盖中，同一直接前序目标不能重复，即使声明不同关系类型。

Proves:
- 原生共享关系计划以两个不同 kind 指向同一目标，返回 DuplicateTarget；此证据不声称真实 CLI 的退出码或错误文本。
