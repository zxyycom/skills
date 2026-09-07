### Case DECISION-UNRECORDED-ARCHIVED-PREDECESSOR-001: 关系事务确认尚未进入 Git HEAD 的归档直接前序

Tests:
- `test:d3ffc4310f956eb8e12180a20ea4b83d610b6aba9347c8014738033e10a07dbb`

Tags:
- `decision-records`

Contract:
- `evolve` 以候选中的关系连接尚未进入 Git HEAD 的 archived 直接前序时，首次调用必须暂停且不写入；archived 前序与 active 前序适用同一确认规则。

Proves:
- 首次 `evolve` 返回包含该 archived 前序和 `替代` 关系类型的确认提示，并逐字节保留候选、前序与索引。
- 带 `--keep-unrecorded-history` 的重试建立后继关系，同时保持前序的 archived 状态。
