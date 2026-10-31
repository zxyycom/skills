### Case VERSION-CONTROL-SYSTEM-CAUSE-001: 分类注入的版本控制系统原因

Tests:
- `test:10bcd278b45eb8d1dbc588b21ccd09edb1734c49da26552d66225cfb78dd0171`

Tags:
- `version-control`

Contract:
- 共享版本控制错误必须把稳定 operation event 与系统原因分类分开，并保留受控操作、目标和详情字段。

Proves:
- 独立注入的 `EACCES` 与 `EPERM` 均分类为 `access-denied`，`ENOENT` 分类为 `tool-unavailable`。
- 普通命令失败保持 `command-failed`，并能独立读取 code、operation、target 与 detail。
