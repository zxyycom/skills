### Case DECISION-STAGE-VERSION-CONTROL-001: Stage 在版本管理不可用时保持 filesystem

Entry:
- `tools/decision-records/tests/stage.test.ts > stage reports unavailable version control without writing filesystem state`
- `bun test --test-name-pattern="^stage reports unavailable version control without writing filesystem state$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- `stage` 需要可用的版本管理决策工作区；环境不可用时必须通过稳定领域诊断失败，不能退化为 filesystem 写入。

Proves:
- 无可用版本管理工作区时命令以行为失败退出且不产生成功输出。
- 领域目录、所选决策和 filesystem 索引状态与调用前完全一致。
