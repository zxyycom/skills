### Case TEST-EVIDENCE-STAGE-CLI-001: 暂存 CLI 区分帮助、用法失败与领域失败

Tests:
- `test:84f7c555eb35f98488b6e67f8af3a0d4f6b536335662132f3591dc397488610d`

Tags:
- `test-evidence`

Contract:
- `stage-index` CLI 必须保留帮助；畸形 Case ID 属于 usage 失败，合法但缺失的 Case ID 属于结构化领域失败。

Proves:
- help 显示可变 Case ID 参数；畸形 ID 以退出码 2、空 stdout 和 stderr 用法错误退出；合法缺失 ID 以退出码 1、空 stderr 和有效 stage JSON 返回 error。
