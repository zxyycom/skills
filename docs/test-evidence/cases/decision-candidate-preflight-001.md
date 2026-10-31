### Case DECISION-CANDIDATE-PREFLIGHT-001: Lifecycle preflight 只读且要求 body-ready candidate

Tests:
- `test:c9c109bd1a953087eba8324f4dc51780a0e098f8d60ab1bbe574d9e25bded1cc`

Tags:
- `decision-records`

Contract:
- 显式生命周期预检保留正文 ready 与只读保证；new 的可选 alignment 仅为未写入的提示，不构造发布投影。

Proves:
- 未完成候选的显式 publish 预检失败、ready 后预检通过且正文和索引不变，正式发布才写入 alignment；new 不默认进行辅助发布准备。
