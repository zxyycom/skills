### Case DECISION-STAGE-DELETION-001: 选择旧 ID 表达删除而非改名

Tests:
- `test:521197bab05d14e88d01105f608f1f11051fe9fcc036e85e692f770cfb23054a`

Tags:
- `decision-records`

Contract:
- 单选 new ID 是 addition，单选 old ID 是 deletion；只有显式 old+new 同选才表达 rename，工具不从内容推断身份。

Proves:
- 选择旧 ID 后只暂存删除，未选择的替代文件不进入 pending。
