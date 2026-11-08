### Case IR-TRACE-REUSE-001: 追溯 context 提升与深度边界

Tests:
- `test:5f19f3e5e0c354682d047be1ab0c97da576c458d76451c9297067f207dc880f6`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 追溯事件 context 成员被直接到达时可提升为 trace；达到深度边界须报告 frontier。

Proves:
- 纯选择器中拆分 context 后被普通关系直接到达时进入 trace；后继深度边界在该成员记录 frontier 并报告 Depth。
