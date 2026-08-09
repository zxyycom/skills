### Case DECISION-ACTIVATE-RELATION-REPLACE-001: Activate 关系覆盖完整替换候选来源关系
Entry:
- `tools/decision-records/tests/evolution.test.ts > activate relation replacement overrides rather than merges candidate relations`
- `bun test --test-name-pattern="^activate relation replacement overrides rather than merges candidate relations$" ./tools/decision-records/tests/run.ts`
Contract:
- Activate 的重复 `--relation` 表达候选最终关系的完整覆盖，不能与候选来源关系追加或合并。
Proves:
- 建立后的候选只保存 CLI 提供的替代关系，不再包含源码中原有的修订关系。
- 覆盖新增的活动目标被归档，已从最终集合移除的原来源目标保持 active。
