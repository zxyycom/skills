### Case ENV-BUN-RUNTIME-001: 环境要求 Vibe 的最低 Bun 运行时

Entry:
- `scripts/environment.test.ts > environment requires the Vibe Bun runtime minimum`
- `bun test --test-name-pattern="^environment requires the Vibe Bun runtime minimum$" ./scripts/environment.test.ts`

Contract:
- 根 `engines.bun` 覆盖锁定 Vibe Check 的最低运行时；环境入口从该边界诊断 Bun，不能将不兼容版本报告为 ready。

Proves:
- Bun 1.3.14 在其他前置条件准备好时允许 setup 和后续 check。
- Bun 1.3.13 被标记为 outdated，输出最低版本和 setup 恢复入口。
