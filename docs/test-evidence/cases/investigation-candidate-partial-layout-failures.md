### Case INVESTIGATION-CANDIDATE-PARTIAL-FAILURES-001: 局部候选读取拒绝不可读或重复 owner

Tests:
- `test:baf2c74febe9372b2664fdd896d6a402e7cb2c73a4e8bbc3444368ffb8da4a57`

Tags:
- `investigation-report`

Contract:
- 候选局部准备必须取得唯一且可读的必需正式资源 owner，不能用空结果掩盖读取或身份失败。

Proves:
- 必需 owner 读取 EACCES 时返回候选读取失败并保留 access-denied；owner 在两个新路径重复出现时同样失败。
