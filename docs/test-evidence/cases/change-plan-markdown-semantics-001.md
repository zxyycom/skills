### Case CHANGE-PLAN-MARKDOWN-SEMANTICS-001: Markdown 语义内容忽略注释并统一换行

Tests:
- `test:1008233f5e4942f0fdda49ef4955d05f4324bcae22dfc21aebeca92ec1f1d376`

Tags:
- `change-plan`

Contract:
- Artifact 只按一次规范化后的 Markdown AST 判断结构与语义内容；HTML 注释不能填充摘要或必需章节。

Proves:
- CRLF 格式的真实摘要与章节内容通过校验，而仅含 HTML 注释的相同位置产生空摘要和两个空章节诊断。
