### Case RESOURCE-LIST-VIEW-WINDOW-001: 摘要与树保留同一筛选分页窗口

Tests:
- `test:23800131f1ec20286bc61fa851e5f8c5ae5e22f9987c0ec205880b0a2ec46a48`
- `test:450020d2066a3c2c321c0d15e3fd7ce1785cb341aadf14305274559024fa4314`
- `test:dcb9e6406f43ad2d495555c0f269cd88541a32b4598298913841411659543bbe`

Tags:
- `resource-records`

Contract:
- 摘要与树只呈现组合筛选、按 ID 排序后的命中窗口；树祖先不计命中、不能消耗集合自身的命中。默认无视图保留普通 JSON，显式 --json 保留完整机器结果。

Proves:
- 组合筛选下，摘要和树的两个单条窗口及越界窗口与独立预期一致，头部准确报告 total、offset、limit 和 unchecked freshness；树按页恢复该命中的实际祖先及深度。
- 同一命中包含单行转义的中文多行标题及所属集合，可按 ID 从当前记录回读原始标题。
- 当父集合先作为子集合的上下文显示时，父集合仍会按 ID 顺序单独出现为命中。
- 两条记录、limit 1 时，默认普通结果保留来源字段和集合归属；两种视图与 --json 组合均返回该完整结果的机器 envelope，且 stderr 为空。
