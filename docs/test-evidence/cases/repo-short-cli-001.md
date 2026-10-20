### Case REPO-SHORT-CLI-001: 仓库维护短命令调用各自领域 CLI

Tests:
- `test:07a95195bc51e44e3cd23a25065bbb0aa7f8e2b604868ea614203a1a644d905e`
- `test:0c3e0a79aa433e1a9c323e893f35af7ea673b7a5c89d6dba05e040d945c5c66b`
- `test:5644ca06ba3d6ff63a0abd94930d03e771713113801fc9dca97db245ccaeb5bc`
- `test:71fcb9f587a64eca1fcfa44db372e722c608b293af4970dd9be00ac4f1765438`
- `test:84d609cda9c16ba1e5da385aa84071d5591349c43a5ecca940786b701779b389`
- `test:c6e74823eb2aa4c8a40bc1ef989e293f31b690dbb846523f36e91205ded01779`
- `test:caa23c35098d3e347f804c738dbaea3fef497a395fb61af193154d670a32f9c2`
- `test:ce71cc052a0fcc8788b25b1f1ace441b89a8291bd0d78cd7bc17cb8abd62c6cc`

Tags:
- `repository-tooling`

Contract:
- 维护 CLI 的类型化 package script 映射中的每个命令都必须能调用其领域入口，并以稳定能力标识确认没有路由到其他工具。

Proves:
- 映射中的每个 `bun run <command> -- --help` 均成功退出，并返回对应领域 CLI 的稳定能力标识；Change Plan 以 `check-all` 命令表面识别当前入口，Investigation Report 以报告记录及其派生索引的公共说明识别当前入口。
- 维护短命令清单包含 Lightweight Judgment，其 help 通过对应公开入口运行且不读取凭据或调用服务。
- novel-cards 的 help 通过仓库短入口展示本地卡片能力，不扫描项目或调用远端接口。
- 八个命令各有一个可按精确名称独立选择和单独报告的原生测试节点，每个节点只执行一次对应 help 调用。
