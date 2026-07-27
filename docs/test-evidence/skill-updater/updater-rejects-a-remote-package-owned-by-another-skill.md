### Case SKILL-UPDATER-REMOTE-OWNER-001: Updater 拒绝其他 owner 的远端包
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a remote package owned by another skill`
- `bun test --test-name-pattern="^updater rejects a remote package owned by another skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 远端包的 `SKILL.md` owner 必须与 updater 目标一致。
Proves:
- 错误 owner 的 release 包不会写入本地目标。
