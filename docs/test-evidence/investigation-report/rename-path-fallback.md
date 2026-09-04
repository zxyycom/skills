### Case INVESTIGATION-RENAME-PATH-001: 被占用 name 路径回退完整 ID basename

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename falls back to an ID basename without overwriting another report path`
- `bun test --test-name-pattern="^Investigation rename falls back to an ID basename without overwriting another report path$" ./tools/investigation-report/tests/run.ts`

Contract:
- formal target name path 已被独立 sourcePath 占用时，rename 只能回退完整 target ID basename，且不能覆盖该来源。

Proves:
- rename 选择完整 ID sourcePath。
- 已占用 name path 的报告字节保持不变。
