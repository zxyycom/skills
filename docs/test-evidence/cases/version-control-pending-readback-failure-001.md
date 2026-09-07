### Case VERSION-CONTROL-PENDING-READBACK-FAILURE-001: pending 读回失败后恢复原范围

Tests:
- `test:fb8024c47eef4905579a09f20c0457f2aea6000441457a8172a0243e432a410b`

Tags:
- `version-control`

Contract:
- 应用目标后的读回核对属于 pending 范围替换成功条件，读回失败时必须恢复写入前范围。

Proves:
- 目标已应用但读回阶段失败时返回 `pending-replacement-failed`，随后读取的范围逐路径、逐内容等于原快照。
