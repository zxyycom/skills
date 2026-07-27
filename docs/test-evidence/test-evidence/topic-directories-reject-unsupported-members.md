### Case TEST-EVIDENCE-TOPIC-DIRECTORY-001: Topic 目录拒绝不受支持的成员
Entry:
- `tools/test-evidence/tests/run.ts > topic directories reject nested, non-Markdown, and symbolic-link members`
- `bun test --test-name-pattern="^topic directories reject nested, non-Markdown, and symbolic-link members$" ./tools/test-evidence/tests/run.ts`
Contract:
- Topic 目录只能直接包含使用语义 slug 的普通 Markdown 单 case 文件。
Proves:
- 嵌套目录、非 Markdown 文件和符号链接都返回 `catalog.topic-entry-unsupported`。
