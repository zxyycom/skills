### Case SKILL-UPDATER-REMOTE-PAYLOADS-001: Updater 报告无效 release
Entry:
- `tools/skill-updater/tests/run.ts > updater reports invalid release payloads`
- `bun test --test-name-pattern="^updater reports invalid release payloads$" ./tools/skill-updater/tests/run.ts`
Contract:
- GitHub release 响应必须在读取资产前通过结构验证。
Proves:
- 缺少 assets 的 release 产生明确远端 payload 诊断。
