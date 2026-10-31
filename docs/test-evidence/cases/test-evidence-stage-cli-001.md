### Case TEST-EVIDENCE-STAGE-CLI-001: 暂存 CLI 区分帮助、用法失败与领域失败

Tests:
- `test:373f221142fad391bf4a5374974b140ee8461c89e09848d52436ebb495895881`
- `test:6003229b8abacb79e0ef52cb3729f8f4383d7be8b36c63fb6d2f059ff3a40f7a`
- `test:72a781036ab66129737f0e3af1d07c41e237af2e638d2a4753ad6d226194ff5b`

Tags:
- `test-evidence`

Contract:
- `stage-index` CLI 必须保留帮助；畸形 Case ID 属于 usage 失败，合法但缺失的 Case ID 属于结构化领域失败。

Proves:
- 独立 help 节点显示可变 Case ID 参数。
- 独立 usage 节点对畸形 ID 返回退出码 2、空 stdout 和 stderr 用法错误。
- 独立领域失败节点对合法缺失 ID 返回退出码 1、空 stderr 和有效 stage JSON 的 error 状态。
