### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 区分非 Git 工作区与损坏元数据

Tests:
- `test:027fd8bef94fc0895ada14464b6216b75694b73715b77ccf5a9d1097fe260b06`

Tags:
- `decision-records`

Contract:
- stage 需要受版本控制的 workspace，并区分不可用与 Git 元数据损坏。

Proves:
- index scope 对非 Git 目录返回 NotRepository；损坏的 .git 元数据返回其他 Git 错误。
