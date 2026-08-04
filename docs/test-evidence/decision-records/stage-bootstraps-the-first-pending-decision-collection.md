### Case DECISION-STAGE-BOOTSTRAP-001: Stage 引导首个 pending 决策集合

Entry:
- `tools/decision-records/tests/stage.test.ts > stage bootstraps the first pending decision collection`
- `bun test --test-name-pattern="^stage bootstraps the first pending decision collection$" ./tools/decision-records/tests/stage.test.ts`

Contract:
- revision 尚无决策范围时，`stage` 使用完整合法的 filesystem 领域目录表与显式选择的已建立决策构造首个 pending 集合。

Proves:
- `HEAD` 已由决策范围外的提交建立，但其 `docs/decisions` 范围为空，首次决策集合仍从完整合法的 filesystem 领域目录表引导。
- pending 同时包含 filesystem 领域目录表、所选决策和由该来源生成的完整索引。
- 索引只含所选首条决策且 `sourceRevision` 与 pending 来源一致，filesystem 不新增索引文件。
