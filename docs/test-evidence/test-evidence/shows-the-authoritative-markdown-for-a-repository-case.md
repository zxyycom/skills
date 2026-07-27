### Case TEST-EVIDENCE-SHOW-REPOSITORY-001: 仓库 Topic Case 可展开权威 Markdown
Entry:
- `tools/test-evidence/tests/repository-catalog.test.ts > shows the authoritative Markdown for a repository case`
- `bun test --test-name-pattern="^shows the authoritative Markdown for a repository case$" ./tools/test-evidence/tests/run.ts`
Contract:
- Show 必须把已登记 case ID 解析回 topic 归属、单 case 源路径与权威 Markdown。
Proves:
- 已知固定契约 case 返回 `test-evidence` topic 下的自身内容，且不混入其他单 case 文件。
