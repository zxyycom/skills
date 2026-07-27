### Case DECISION-CONFIGURED-RELATIVE-DIRECTORY-001: 相对决策目录从 workspace 根解析
Entry:
- `tools/decision-records/tests/configured-decision-directory.test.ts > relative decision directories resolve from the workspace root`
- `bun test --test-name-pattern="^relative decision directories resolve from the workspace root$" ./tools/decision-records/tests/run.ts`
Contract:
- 相对 decisionsDir 必须以 workspace 根为解析基准，并保持工作区相对索引路径。
Proves:
- API 扫描定位配置目录，报告规范相对 index 路径，CLI check 成功。
