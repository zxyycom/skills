### Case DECISION-LIST-ARGS-001: Decision CLI 校验近期分页与时间范围参数

Tests:
- `test:420d14768d535213189f03a210a58c05df48bf71092cebc6c8fddb6a59e09ad4`
- `test:9e384b8c0a87b3e039b43a96a8b5b173bb1d056653e69f560eca9fc5aa497a96`

Tags:
- `decision-records`

Contract:
- Decision list help 公开 createdAt 范围、状态与 alignment、limit/offset 和 detail；非法时间范围、分页值和重复 limit 必须失败。

Proves:
- 真实原生 CLI 的 list help 包含 `--created-from`、`--created-to`、`--status`、`--alignment`、`--limit`、`--offset` 和 `--detail`。
- 真实 CLI 对非法或逆序时间、limit 0/1001、负 offset 和重复 limit 均退出 2 且 JSON `ok:false`；未覆盖所有重复选项。
