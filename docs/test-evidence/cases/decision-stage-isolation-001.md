### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Tests:
- `test:5e79a527cd7ed428352c98468a2e4ae9a7832028fa5603a9998f564db1f2bb1d`

Tags:
- `decision-records`

Contract:
- 所选对象按 scope 采用当前完整版本，未选对象保持既有 pending 版本，而非重新套用 HEAD 或工作区版本。

Proves:
- 真实 stage 连续选择 A、B 后再次选择 A，A 更新为工作区新版本，B 的旧 pending 正文与标题保持，重复刷新无变化。
