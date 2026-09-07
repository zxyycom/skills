### Case DECISION-STAGE-SOURCE-PREFLIGHT-001: Stage 拒绝选择来源在快照后的漂移

Tests:
- `test:f5173ddbd2e3cff946f794ea5725d76e8f1ca2d5936fe918303f126549dcb5ea`

Tags:
- `decision-records`

Contract:
- 选择的 filesystem source 在初次快照后、pending replace 前发生字节修改、删除或移动时，Stage 必须拒绝且不写入 pending。

Proves:
- 受控第二次 source read 分别注入三种漂移，均报告预写入失败且暂存区为空。
