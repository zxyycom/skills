### Case DECISION-UNRECORDED-COLLAPSE-001: Evolve 以显式最终关系折叠未提交中间决策
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapses an unrecorded intermediate with explicit final relations`
- `bun test --test-name-pattern="^evolve collapses an unrecorded intermediate with explicit final relations$" ./tools/decision-records/tests/run.ts`
Contract:
- `evolve --collapse-unrecorded` 只删除未进入 Git HEAD 的单个活动已建立中间前序，并把调用者提供的关系作为后继的完整最终关系集合。
Proves:
- 折叠前的最终关系目标已经 archived，且确实是中间记录原有的直接前序。
- 合法折叠删除未提交中间记录，并从派生索引移除该记录。
- 后继只保留调用者显式给出的原中间记录直接上游关系，严格决策检查继续通过。
