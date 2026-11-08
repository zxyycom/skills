### Case DECISION-EVOLVE-GROUPED-HISTORY-001: 分组引入前序须确认未记录历史

Tests:
- `test:e64bbdabf20051a7181e66a07d33b81561e69122e502161095532596153299bb`

Tags:
- `decision-records`

Contract:
- 历史门禁按后继的最终关系执行，包括仅由分组 replacement 引入的前序。

Proves:
- 真实 Git fixture 中候选原本无关系、分组引入未记录活动前序；预检要求历史确认并保留索引和候选字节，显式确认后提交并归档前序。该节点使用原生操作而非 CLI 参数解析。
