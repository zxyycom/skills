### Case DECISION-CONFIGURED-ABSOLUTE-DIRECTORY-001: 绝对决策目录可位于 workspace 之外
Entry:
- `tools/decision-records/tests/configured-decision-directory.test.ts > absolute decision directories remain outside the workspace root`
- `bun test --test-name-pattern="^absolute decision directories remain outside the workspace root$" ./tools/decision-records/tests/run.ts`
Contract:
- 显式绝对 decisionsDir 必须直接定位工作区外的决策集合，并保持绝对索引路径。
Proves:
- API 扫描不把绝对目录重定位到 workspace 内，CLI check 对外部集合成功。
