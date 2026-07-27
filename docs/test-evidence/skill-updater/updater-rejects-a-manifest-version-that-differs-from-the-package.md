### Case SKILL-UPDATER-MANIFEST-VERSION-001: Updater 拒绝 manifest 与包版本不一致
Entry:
- `tools/skill-updater/tests/run.ts > updater rejects a manifest version that differs from the package`
- `bun test --test-name-pattern="^updater rejects a manifest version that differs from the package$" ./tools/skill-updater/tests/run.ts`
Contract:
- Release manifest 声明版本必须与远端 `SKILL.md` 版本一致。
Proves:
- 版本不一致在安装前被拒绝且目标未被替换。
