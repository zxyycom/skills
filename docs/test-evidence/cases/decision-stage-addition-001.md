### Case DECISION-STAGE-ADDITION-001: 单选新 ID 表达 addition 而非改名

Tests:
- `test:61d316dba451f4db3a103b26f69e1d08965cafd346032d8e837f970b14e34326`

Tags:
- `decision-records`

Contract:
- 选择新 ID 表达新增而不隐式处理未选旧 ID。

Proves:
- 真实 Git 中选择新增 B 后 pending 有 B 新正文，未选 A 仍保留 HEAD 正文，尽管 A 的工作区正文已编辑。
