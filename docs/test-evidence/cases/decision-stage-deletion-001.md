### Case DECISION-STAGE-DELETION-001: 选择旧 ID 表达删除而非改名

Tests:
- `test:e93a001bdc6122e6909c687e476c4d6e423991b8b0af29ac991e4dfe59857594`

Tags:
- `decision-records`

Contract:
- 单选 old ID 表达已同步删除，工具不从未选 replacement 推断身份改名。

Proves:
- 真实 stage 删除 old 的 pending 正文和投影，未选 replacement 不加入，retained 的正文保持。
