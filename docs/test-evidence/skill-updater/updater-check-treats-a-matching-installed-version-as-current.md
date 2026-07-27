### Case SKILL-UPDATER-CURRENT-CHECK-001: 当前安装版本被识别为无需更新
Entry:
- `tools/skill-updater/tests/run.ts > updater check treats a matching installed version as current`
- `bun test --test-name-pattern="^updater check treats a matching installed version as current$" ./tools/skill-updater/tests/run.ts`
Contract:
- Check 模式按版本判断当前安装，不因本地正文定制误报过期。
Proves:
- 本地版本与 manifest 一致时报告 current 且不写入文件。
