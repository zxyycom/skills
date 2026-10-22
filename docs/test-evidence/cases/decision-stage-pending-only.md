### Case DECISION-STAGE-PENDING-ONLY-001: 仅pending存在的新增可移动和撤销

Tests:
- `test:66e129c33b9c616e1140c270486856f43bbdf87b04aa40696be2e4929bb34a1b`

Tags:
- `decision-records`

Contract:
- domain/all 按固定 HEAD 已变化的 pending Markdown 身份清理旧位置，pending-only 对象可以再次移动或撤销。

Proves:
- 仅 domain 暂存的新对象改名后再次暂存清理旧路径，工作区撤销后再选同 ID 能移除仅 pending 存在的新位置。
