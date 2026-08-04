### Case DECISION-STAGE-INPUT-001: Stage 拒绝非法重复和缺失路径且保持 pending

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects invalid duplicate and missing paths without changing pending`
- `bun test --test-name-pattern="^stage rejects invalid duplicate and missing paths without changing pending$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- `stage` 只接受唯一、合法且至少存在于 revision 或 filesystem 一处的决策根相对 POSIX Markdown 路径。

Proves:
- 越界路径、重复路径和两处都缺失的路径均以参数失败退出且不产生成功输出。
- 每次失败后完整 pending 条目保持调用前状态。
