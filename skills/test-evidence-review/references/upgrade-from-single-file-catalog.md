# 从单文件测试目录升级

仅当工作区仍使用 `schemaVersion: 1`，或 `catalogPath` 指向单个 Markdown 文件时
读取。当前工具只接受按主题拆分的目录模型，不提供双轨读取。

## 升级步骤

1. 在原目录位置建立主题子目录，例如 `docs/test-evidence/cases/`。
2. 按稳定测试责任把原文件中的 case 原样移动到语义明确的主题 Markdown；每个主题
   文件至少保留一个 case，不因拆文件修改 case ID 或扩大 case 粒度。
3. 将 `.test-evidence.json` 改为 `schemaVersion: 2`，并让 `catalogPath` 指向主题
   目录而不是文件。
4. 运行 `sync-index --write` 从全部主题文件重建统一索引，再运行 `check`。
5. 查询代表性 case，确认结果中的 `sourcePath` 和 `show` 展开的主题原文一致。

旧单文件和旧索引在升级验证通过后删除；不要同时维护单文件与主题目录，也不要把
拆分过程解释为新增或合并测试证据。
