### Case ENV-NODE-RUNTIME-001: 环境要求 Vibe 的最低 Node 运行时

Tests:
- `test:d98de2b5cb9a9685fa1746bcd49751a61e436b8b571542b68f5fc5cc3d68f529`

Tags:
- `repository-tooling`

Contract:
- 根 `engines.node` 必须覆盖锁定 Vibe Check 的最低 Node 宿主；环境入口从该边界诊断 Node，不能将不兼容版本报告为 ready。

Proves:
- Node 24.18.0 在其他前置条件准备好时允许 setup 和后续 check。
- Node 24.17.0 被标记为 outdated，并输出所需最低版本。
