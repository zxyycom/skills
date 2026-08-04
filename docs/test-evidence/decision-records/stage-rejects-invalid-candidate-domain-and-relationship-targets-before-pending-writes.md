### Case DECISION-STAGE-TARGET-VALIDATION-001: Stage 在写入前拒绝非法目标集合

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects invalid candidate domain and relationship targets before pending writes`
- `bun test --test-name-pattern="^stage rejects invalid candidate domain and relationship targets before pending writes$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- `stage` 必须在 pending 写入前完整验证目标来源的建立状态、revision 领域目录归属和关系目标集合，不自动扩大选择集。

Proves:
- 所选候选和未进入目标来源的关系目标均导致行为失败。
- filesystem 领域目录表即使合法新增领域，已有决策基线仍使用不含该领域的 revision 目录表；所选新领域决策在任何 pending 写入前失败。
- 每种目标校验失败都保持完整 pending 条目不变。
