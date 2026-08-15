### Case DECISION-STAGE-SOURCE-PREFLIGHT-001: Stage 拒绝选择来源在快照后的漂移

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects selected source drift before replacing the pending snapshot`
- `bun test --test-name-pattern="^stage rejects selected source drift before replacing the pending snapshot$" ./tools/decision-records/tests/run.ts`

Contract:
- 选择的 filesystem source 在初次快照后、pending replace 前发生字节修改、删除或移动时，Stage 必须拒绝且不写入 pending。

Proves:
- 受控第二次 source read 分别注入三种漂移，均报告预写入失败且暂存区为空。
