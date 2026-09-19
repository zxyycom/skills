### Case ENV-BUN-RUNTIME-001: 环境要求项目固定的精确 Bun 运行时

Tests:
- `test:87151e2d8f3dc142d39af6efb7736cb2021d3a2bc439fd8e12348e1f362ceda2`

Tags:
- `repository-tooling`

Contract:
- 根 `engines.bun` 声明生成和运行 package scripts 的精确 Bun 运行时；环境入口从该边界诊断 Bun，不能将较旧或较新的漂移版本报告为 ready。

Proves:
- Bun 1.4.2 在其他前置条件准备好时允许 setup 和后续 check。
- Bun 1.4.1 与 1.4.3 都被标记为 mismatch，输出精确期望版本和 setup 恢复入口。
