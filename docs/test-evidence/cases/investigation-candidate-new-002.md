### Case INVESTIGATION-CANDIDATE-NEW-002: new rejects conflicting or unsafe candidate identities without overwriting

Tests:
- `test:60b5eeed7f7bbf65d681b44c7b22ae58244df8efaa83a573d40e207122dddf86`

Tags:
- `investigation-report`

Contract:
- `new` 只接受规范 Investigation ID、formedAt、非重复 tags 和直接关系，且不得覆盖已有 candidate、与正式报告共享身份或不安全的候选路径。

Proves:
- 非法 ID、正式身份冲突、集合锁占用和候选符号链接在零写入时返回失败；并发同 ID 创建恰好保留一个候选。
- 重复创建保持既有 candidate 的字节不变。
