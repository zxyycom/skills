### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Tests:
- `test:e9629a4062b9ba08b1643e320b474858d97748b7bc886c7ba875ffe390fc6d8c`

Tags:
- `decision-records`

Contract:
- Stage 不从文本差异或未选新增推断身份改名。

Proves:
- 真实 stage 单选已删除 old 时删除其 pending 正文和投影，未选 replacement 不进入 pending，retained 保持。
