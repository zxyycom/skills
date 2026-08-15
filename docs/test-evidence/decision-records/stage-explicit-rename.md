### Case DECISION-STAGE-RENAME-001: Stage 仅以显式 old+new ID 表达 basename 改名

Entry:
- `tools/decision-records/tests/stage.test.ts > stage expresses a basename identity rename by selecting both IDs`
- `bun test --test-name-pattern="^stage expresses a basename identity rename by selecting both IDs$" ./tools/decision-records/tests/run.ts`

Contract:
- 只有显式同时选择 old+new ID 才表达 basename rename；新正文编辑与 identity 变更一同进入 pending index，工具不猜测。

Proves:
- 暂存后旧 ID 消失，新 ID 具有编辑后的标题。
