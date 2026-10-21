### Case INVESTIGATION-CANDIDATE-PARTIAL-FAILURES-001: 局部候选读取拒绝不可读或重复 owner

Tests:
- `test:2bd0ccbfdd08467e72c4607e3c08d7341af5baa4f67e2b0142957f4523f6c4aa`
- `test:8d0b7a1e1ebd2bb3aebcf6083364740755b898ca6840a89ea50cac8fa57e7773`

Tags:
- `investigation-report`

Contract:
- 候选局部准备必须取得唯一且可读的必需正式资源 owner，不能用空结果掩盖读取或身份失败。

Proves:
- 必需 owner 读取 EACCES 时返回候选读取失败并保留 access-denied；owner 在两个新路径重复出现时同样失败。
