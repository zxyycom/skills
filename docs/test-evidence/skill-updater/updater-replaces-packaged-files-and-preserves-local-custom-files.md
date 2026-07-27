### Case SKILL-UPDATER-REPLACE-PRESERVE-001: Updater 替换包文件并保留本地自定义
Entry:
- `tools/skill-updater/tests/run.ts > updater replaces packaged files and preserves local custom files`
- `bun test --test-name-pattern="^updater replaces packaged files and preserves local custom files$" ./tools/skill-updater/tests/run.ts`
Contract:
- 更新必须替换远端包拥有的文件，同时保留不属于包的本地文件。
Proves:
- 包文件更新为远端内容，本地自定义文件内容不变。
