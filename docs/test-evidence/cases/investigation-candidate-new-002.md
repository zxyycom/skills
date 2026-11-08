### Case INVESTIGATION-CANDIDATE-NEW-002: 重复候选创建不覆盖原文件

Tests:
- `test:a55abd86facf4cb1a8b43953e0695b70b89ac26fe7f9fd938a29623210ff99cc`

Tags:
- `investigation-report`

Contract:
- 同一 Investigation candidate 不得被重复新建覆盖。

Proves:
- 真实 CLI 首次创建候选成功，第二次以相同 ID 调用失败；已有候选字节和候选目录项保持不变。
