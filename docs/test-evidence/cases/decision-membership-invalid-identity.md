### Case DECISION-MEMBERSHIP-INVALID-IDENTITY-001: 失败身份不冒充未发现且保留正文诊断

Tests:
- `test:dcd8d20ed6b0d6c5af8fc03759b4eb5d19d53e3428897e4631def11002215359`

Tags:
- `decision-records`

Contract:
- 成员发现已解析但失败的身份以 null 表达，不进入可用身份集合；完整扫描仍报告来源 YAML 失败。

Proves:
- 坏 YAML 保存原字节及 null 身份，扫描生成非法来源记录并保留带文件位置的 frontmatter 诊断。
