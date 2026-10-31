### Case INVESTIGATION-CURRENT-INDEX-FAILURES-001: Current 加载保留外部边界失败

Tests:
- `test:69a29d8c416296b41b2c854c065acad2914f3432212f133966e869afb913e254`

Tags:
- `investigation-report`

Contract:
- Current 加载不能将坏索引、不兼容 definition、缺失索引、取消或不安全来源解释为合法成功。

Proves:
- 非法 JSON、definition 不符、缺失索引、已取消信号和正式来源 symlink 均失败，缺失索引保留 index-missing 诊断。
