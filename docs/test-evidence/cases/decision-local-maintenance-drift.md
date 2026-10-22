### Case DECISION-LOCAL-MAINTENANCE-DRIFT-001: 所选来源漂移使普通维护零写入失败

Tests:
- `test:f355aaec3218d223f3fc944532ed11434518268f55feef3a4623f71ede0528cd`

Tags:
- `decision-records`

Contract:
- 普通维护不得以发布投影掩盖所选来源当前指纹或投影漂移。

Proves:
- A 未同步正文变更使 mark-aligned 失败并提示同步；当前正文和索引均未修改。
