### Case INVESTIGATION-STAGE-ISOLATION-001: 单主题暂存隔离并保留领域文件边界
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index isolates one selected topic without reading or staging domain files`
- `bun test --test-name-pattern="^stage-index isolates one selected topic without reading or staging domain files$" ./tools/investigation-report/tests/run.ts`
Contract:
- A、B 主题同时改变时，选择 A 只能把 A 的索引条目带入 `pending`；主题 Markdown、随附资源、工作区索引和其他待提交路径必须保持原样。
Proves:
- 即使 A、B Markdown 在同步后都被改成无效内容，JSON 命令仍只从两份索引组合 A；pending 保留 B 基线和既有外部文件，领域文件字节不变。
