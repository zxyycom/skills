### Case SKILL-UPDATER-CANONICAL-PATH-001: Updater 拒绝非规范包路径别名
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects aliased non-canonical package paths`
- `bun test --test-name-pattern="^updater rejects aliased non-canonical package paths$" ./tools/skill-updater/tests/run.ts`
Contract:
- Release zip 中的 skill 文件必须位于规范且无别名的包路径。
Proves:
- 路径别名和非规范路径在解包写入前被拒绝。
