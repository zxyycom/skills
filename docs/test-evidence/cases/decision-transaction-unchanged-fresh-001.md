### Case DECISION-TRANSACTION-UNCHANGED-FRESH-001: unchanged 仍独立验证相关来源

Tests:
- `test:046f29e3386b52fa2ecbb18afb85315f51955aa53a8dc7fb0fe18fbeba39acdd`

Tags:
- `decision-records`

Contract:
- unchanged 不能跳过适用来源、成员和索引保护，也不能扩大全集正文 scope。

Proves:
- 已无关系变化的请求在 prepare 与独立 fresh 之间遭相关来源编辑后返回 no-change，保留后来编辑和原索引。
