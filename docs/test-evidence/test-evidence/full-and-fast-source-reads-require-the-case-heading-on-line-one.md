### Case TEST-EVIDENCE-CASE-FIRST-LINE-001: 完整与快速读取要求 Case 标题位于首行

Entry:
- `tools/test-evidence/tests/catalog.test.ts > full and fast source reads require the case heading on line one`
- `bun test --test-name-pattern="^full and fast source reads require the case heading on line one$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- 每个 case 源文件的第一行必须是合法 `### Case <CASE-ID>: <title>`；完整 catalog 读取与快速 revision 读取必须执行同一首行身份边界。

Proves:
- 标题前存在空行、HTML comment 或 frontmatter 时，完整目录校验返回首行诊断，快速 revision 读取也拒绝该来源。
- 仅使用孤立 CR 分隔的内容不构成合法逐行 case 源，两条读取路径同样拒绝。
