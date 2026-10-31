### Case INVESTIGATION-STAGE-OWNER-DEPENDENCY-001: 正式 owner 是索引声明依赖而非正文输入

Tests:
- `test:aa8eae848907f9a121812ec75f79a392237cb129eb21e12f54bb61d7121d4d73`

Tags:
- `investigation-report`

Contract:
- 直接资源 owner 的声明从索引验证，不扩大正文读取或写入选择。

Proves:
- resolver 的来源选择仅含所选报告与直接资源，读取观察不含 owner 正文；未选 owner 当前正文漂移不会被阶段来源验证读取或阻断。
