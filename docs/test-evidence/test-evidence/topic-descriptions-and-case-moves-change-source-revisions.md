### Case TEST-EVIDENCE-REVISION-TOPIC-MOVE-001: Topic 描述与 Case 移动改变源 Revision
Entry:
- `tools/test-evidence/tests/run.ts > topic descriptions and case moves change source revisions without changing case identity`
- `bun test --test-name-pattern="^topic descriptions and case moves change source revisions without changing case identity$" ./tools/test-evidence/tests/run.ts`
Contract:
- 源 revision 必须覆盖 topic 定义与 case 源路径，而 case ID 在合法移动后保持稳定。
Proves:
- 修改 topic 描述和跨 topic 移动文件都会改变 revision，show 仍以原 ID 返回新的源路径与 topic。
