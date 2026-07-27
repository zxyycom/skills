### Case SKILL-UPDATER-UNVERSIONED-001: Check 报告未版本化安装
Entry:
- `tools/skill-updater/tests/run.ts > updater check reports an unversioned installed skill`
- `bun test --test-name-pattern="^updater check reports an unversioned installed skill$" ./tools/skill-updater/tests/run.ts`
Contract:
- 缺少有效版本 metadata 的已安装 skill 必须被明确标记为 unversioned。
Proves:
- Check 输出本地未版本化状态并与远端版本比较。
