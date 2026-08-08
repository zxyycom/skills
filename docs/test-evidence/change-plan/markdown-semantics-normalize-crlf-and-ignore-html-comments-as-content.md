### Case CHANGE-PLAN-MARKDOWN-SEMANTICS-001: Markdown 语义内容忽略注释并统一换行
Entry:
- `tools/change-plan/tests/markdown.test.ts > Markdown semantics normalize CRLF and ignore HTML comments as content`
- `bun test --test-name-pattern="^Markdown semantics normalize CRLF and ignore HTML comments as content$" ./tools/change-plan/tests/run.ts`
Contract:
- Artifact 只按一次规范化后的 Markdown AST 判断结构与语义内容；HTML 注释不能填充摘要或必需章节。
Proves:
- CRLF 格式的真实摘要与章节内容通过校验，而仅含 HTML 注释的相同位置产生空摘要和两个空章节诊断。
