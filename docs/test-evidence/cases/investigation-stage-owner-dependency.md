### Case INVESTIGATION-STAGE-OWNER-DEPENDENCY-001: 正式 owner 是索引声明依赖而非正文输入

Tests:
- `test:5657f62961e6f35b8785c5106d093bc4368031eb55a361aff30c053591f827d4`

Tags:
- `investigation-report`

Contract:
- domain stage 消费所选报告的资源 owner 索引声明，不自动写入未选 owner 资源。

Proves:
- owner 正文不存在且共享资源工作区字节与 pending 不同时，domain 仍暂存所选报告并保留 owner 资源的 pending 字节。
