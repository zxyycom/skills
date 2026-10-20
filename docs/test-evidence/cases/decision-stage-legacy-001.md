### Case DECISION-STAGE-LEGACY-001: Stage 拒绝旧领域基线

Tests:
- `test:6f40ec4cec12465f37839bd1c6855cead9b79ed28538301e45dcc553f71b9426`

Tags:
- `decision-records`

Contract:
- 当前 Stage 不能把旧领域目录 revision 与当前 ID/布局来源混合为 pending snapshot。

Proves:
- 纯 baseline 路径分类拒绝含 decision-domains.json 的旧领域目录范围，给出 unsupported file 错误。
