### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Tests:
- `test:e93a001bdc6122e6909c687e476c4d6e423991b8b0af29ac991e4dfe59857594`

Tags:
- `decision-records`

Contract:
- Stage 不从文本差异或未选新增推断身份改名。

Proves:
- 真实 stage 单选已删除 old 时删除其 pending 正文和投影，未选 replacement 不进入 pending，retained 保持。
