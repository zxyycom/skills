### Case DECISION-STAGE-DELETION-001: 选择旧 ID 表达删除而非改名

Tests:
- `test:e93a001bdc6122e6909c687e476c4d6e423991b8b0af29ac991e4dfe59857594`

Tags:
- `decision-records`

Contract:
- 单选 new ID 是 addition，单选 old ID 是 deletion；只有显式 old+new 同选才表达 rename，工具不从内容推断身份。

Proves:
- 纯 target 构造将单选 old 记录为 source:null，最终来源为空，未选 replacement 不被加入。
