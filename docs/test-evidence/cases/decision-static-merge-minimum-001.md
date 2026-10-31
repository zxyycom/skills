### Case DECISION-STATIC-MERGE-MINIMUM-001: 严格关系检查拒绝前序不足的纯归并

Tests:
- `test:39a7e2f93b4eed57e0863673d7233df5a74f23b24fa1f260f01023b74e91e43a`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的纯归并关系集必须至少包含两个直接前序。

Proves:
- 真实内存 Markdown 解析及领域图校验对只有一个前序的已建立纯归并返回 pure 归并 relation set 数量不足诊断。
