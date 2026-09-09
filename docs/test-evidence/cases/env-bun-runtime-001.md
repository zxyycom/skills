### Case ENV-BUN-RUNTIME-001: 环境要求项目的最低 Bun 运行时

Tests:
- `test:1f7d8785e5f525287d45630fb9e6ae02690fafb502aefe1451c2867beb9a91a8`

Tags:
- `repository-tooling`

Contract:
- 根 `engines.bun` 声明项目 package scripts 的最低 Bun 运行时；环境入口从该边界诊断 Bun，不能将不兼容版本报告为 ready。

Proves:
- Bun 1.3.14 在其他前置条件准备好时允许 setup 和后续 check。
- Bun 1.3.13 被标记为 outdated，输出最低版本和 setup 恢复入口。
