### Case INVESTIGATION-STAGE-OWNER-DEPENDENCY-001: 正式 owner 是索引声明依赖而非正文输入

Tests:
- `test:d7fee0968ff0a494baef605008f929cd9ede86c19fb3d95f411c5a8fef151d6f`

Tags:
- `investigation-report`

Contract:
- 直接资源 owner 的声明从索引验证，不扩大正文读取或写入选择。

Proves:
- resolver 的来源选择仅含所选报告与直接资源，读取观察不含 owner 正文；未选 owner 当前正文漂移不会被阶段来源验证读取或阻断。
