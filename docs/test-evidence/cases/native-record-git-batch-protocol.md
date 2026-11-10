### Case NATIVE-RECORD-GIT-BATCH-PROTOCOL-001: Git 批量 blob 协议与身份

Tests:
- `test:6ce8a805b32859920ff673c8ba3a33cfb4717df9f62c7f5102f47d0ea9d468cc`
- `test:d7a3396822ebc10790fc524898495a5b2912e2db819eae9b03fc4f73a33ee464`

Tags:
- `record-rust`

Contract:
- 批量 blob 响应必须完整且对象类型、大小及内容身份与请求一致。

Proves:
- 固定 SHA-1 与 SHA-256 已知值验证有效响应；错误对象、类型、大小、截断、额外输出和伪造内容被拒绝。
- 原始 SHA-1 碰撞向量触发检测拒绝，Git blob 头与正文的已知摘要通过；该向量不证明 Git 前缀碰撞攻击。
