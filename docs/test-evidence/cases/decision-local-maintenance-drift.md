### Case DECISION-LOCAL-MAINTENANCE-DRIFT-001: 所选来源漂移使普通维护零写入失败

Tests:
- `test:f732b4f9d7db5003bfd6aba76d29eb86a2fdd68c47b04683f8088ba0564b77cd`

Tags:
- `decision-records`

Contract:
- 普通维护不得以发布投影掩盖所选来源当前指纹或投影漂移。

Proves:
- A 未同步正文变更使 mark-aligned 失败并提示同步；当前正文和索引均未修改。
