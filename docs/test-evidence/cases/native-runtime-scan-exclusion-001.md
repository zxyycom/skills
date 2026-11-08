### Case NATIVE-RUNTIME-SCAN-EXCLUSION-001: 项目检查仅排除受管本地运行时

Tests:
- `test:0a01ab45309020b96f7b5d31f42d1dbbfbbf8586c1c2a4484784aca81b098fef`

Tags:
- `repository-tooling`

Contract:
- 准备的 `.local/record-cli/` generation 是可丢弃构建输出，不应作为项目 Markdown 输入；不能因此排除其他 `.local` 内容。

Proves:
- 私有文件树中的运行时源码副本被排除，而 `.local/other/README.md` 仍进入 Markdown 输入选择。
