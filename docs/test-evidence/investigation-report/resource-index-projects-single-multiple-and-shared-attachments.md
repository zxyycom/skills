### Case INVESTIGATION-RESOURCE-PROJECTION-001: 资源索引投影单项、多项与共享引用

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource index projects single multiple and shared attachments`
- `bun test --test-name-pattern="^resource index projects single multiple and shared attachments$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告声明的文本与二进制资源必须按报告位置进入主题 state，共享资源在集合级 metadata 中只保存一份 SHA-256 摘要。

Proves:
- 单资源、多资源和跨报告、跨主题共享关系生成按 reportIndex 和资源 ID 排序的投影。
- 文本与二进制原始字节各自产生可独立复算的 64 个小写十六进制字符 SHA-256。
