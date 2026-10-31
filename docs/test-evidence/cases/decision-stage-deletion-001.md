### Case DECISION-STAGE-DELETION-001: 选择旧 ID 表达删除而非改名

Tests:
- `test:e9629a4062b9ba08b1643e320b474858d97748b7bc886c7ba875ffe390fc6d8c`

Tags:
- `decision-records`

Contract:
- 单选 old ID 表达已同步删除，工具不从未选 replacement 推断身份改名。

Proves:
- 真实 stage 删除 old 的 pending 正文和投影，未选 replacement 不加入，retained 的正文保持。
