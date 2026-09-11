### Case VERSION-CONTROL-PENDING-READBACK-FAILURE-001: pending 读回失败后恢复原范围

Tests:
- `test:b1a05302720505ea5beaf6afe022efe562a597c8a41c8f358aae28ed2b3391d7`

Tags:
- `version-control`

Contract:
- 应用目标后的读回核对属于 pending 范围替换成功条件，读回失败时必须恢复写入前范围。

Proves:
- 目标已应用但读回阶段失败时返回 `pending-replacement-failed`，随后读取的范围逐路径、逐内容等于原快照。
