### Case DECISION-CANDIDATE-PREFLIGHT-001: Lifecycle preflight 只读且要求 body-ready candidate

Tests:
- `test:6f90a363b908a665b8dabd54abe86b6c92b8b67c389970a16dfdb67192a8739d`

Tags:
- `decision-records`

Contract:
- publish 预检要求正文 ready，且预检不写入来源和索引。

Proves:
- 真实 CLI 对未完成候选预检失败，正文补全后预检成功；两次均保持所选正文和正式索引字节。
