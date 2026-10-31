### Case CHANGE-PLAN-MARKDOWN-SEMANTICS-001: Markdown 语义内容忽略注释并统一换行

Tests:
- `test:3999e62f48c466ed7c1b55f535457d550c9e0430cb42e9b4da6a3258d189739e`

Tags:
- `change-plan`

Contract:
- Artifact 只按一次规范化后的 Markdown AST 判断结构与语义内容；HTML 注释不能填充摘要或必需章节。

Proves:
- CRLF 格式的真实摘要与章节内容通过校验，而仅含 HTML 注释的相同位置产生空摘要和两个空章节诊断。
