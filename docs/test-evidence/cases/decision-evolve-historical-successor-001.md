### Case DECISION-EVOLVE-HISTORICAL-SUCCESSOR-001: Evolve 拒绝无可确认对齐状态的历史归档后继

Tests:
- `test:70bb3baea10334cd63c8524c175f6e63be03c4f2831f73442c52f7acd04920ce`

Tags:
- `decision-records`

Contract:
- 历史 `archived + alignment: null` 记录没有可供 successor 参数确认的完整对齐状态，不进入普通关系修订路径。

Proves:
- 选择 alignment 为 null 的归档后继时，evolve 失败并报告必须具有非空 alignment。
