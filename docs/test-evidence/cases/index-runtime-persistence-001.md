### Case INDEX-RUNTIME-PERSISTENCE-001: 快速拒绝不兼容索引并完整解析损坏投影

Tests:
- `test:5613096e72f57933936be15e27338e549e51eaaf0b39102b9db0d51e0a42546a`

Tags:
- `index-runtime`

Contract:
- Runtime open 先按 definition identity 拒绝不兼容 snapshot；current snapshot 的领域 state 必须在建立 reader 前完整解析，并可从权威来源重建。

Proves:
- Definition version 不兼容返回 `state-index.definition-version-mismatch`；错误 state 类型返回带路径的 `state-index.state-parse-failed`，写同步恢复索引。
