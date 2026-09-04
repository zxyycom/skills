### Case DECISION-RENAME-PREFLIGHT-001: preflight 零写入且 legacy candidate 显式选日期

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename preflight is read-only and legacy candidates require an explicit dated target`
- `bun test --test-name-pattern="^Decision rename preflight is read-only and legacy candidates require an explicit dated target$" ./tools/decision-records/tests/run.ts`

Contract:
- rename preflight 不得写入；legacy Decision candidate 的 name target 必须失败为 `date-required`，完整 dated target 才能明确迁移日期。

Proves:
- preflight 和日期不匹配 target 后原 Markdown 字节保持不变。
- legacy candidate 的 name target 返回 `rename-date-required`，完整 dated target 成功。
