### Case INVESTIGATION-CURRENT-INDEX-FAILURES-001: Current 加载保留外部边界失败

Tests:
- `test:7e02fbe8fa9db76c58f20a6e0654489acc3acd276142b43ae0927700292ca5e2`

Tags:
- `investigation-report`

Contract:
- Current 加载不能将坏索引、不兼容 definition、缺失索引、取消或不安全来源解释为合法成功。

Proves:
- 非法 JSON、definition 不符、缺失索引、已取消信号和正式来源 symlink 均失败，缺失索引保留 index-missing 诊断。
