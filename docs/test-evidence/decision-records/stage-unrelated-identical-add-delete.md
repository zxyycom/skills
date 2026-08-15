### Case DECISION-STAGE-NO-INFERENCE-001: Stage 不把无关的相同删除/新增绑定为改名

Entry:
- `tools/decision-records/tests/stage.test.ts > stage does not bind unrelated identical deletion and addition as a rename`
- `bun test --test-name-pattern="^stage does not bind unrelated identical deletion and addition as a rename$" ./tools/decision-records/tests/run.ts`

Contract:
- CLI 不从文本相同的删除/新增推断身份改名。

Proves:
- 暂存条目保持独立 D/A，而非 rename。
