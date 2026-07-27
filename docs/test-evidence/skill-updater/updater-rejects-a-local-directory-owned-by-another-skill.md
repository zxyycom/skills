### Case SKILL-UPDATER-LOCAL-OWNER-001: Updater 拒绝其他 skill 拥有的目录
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a local directory owned by another skill`
- `bun test --test-name-pattern="^updater rejects a local directory owned by another skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 目标目录中的 `SKILL.md` owner 必须与 updater 目标 skill 一致。
Proves:
- 其他 skill 的目录在远端获取和写入前被拒绝。
