### Case DECISION-RENAME-PATH-001: 冲突 name 路径回退完整 ID basename

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename falls back to its dated basename without overwriting an occupied name path`
- `bun test --test-name-pattern="^Decision rename falls back to its dated basename without overwriting an occupied name path$" ./tools/decision-records/tests/run.ts`

Contract:
- 目标 name basename 已被其他合法 sourcePath 占用时，Decision rename 只能回退完整 target ID basename，且不得覆盖占用来源。

Proves:
- rename 在完整 ID basename 建立目标文件。
- 已占用 name path 的原 Markdown 保持原字节和 identity。
