### Case INVESTIGATION-RELATION-SUMMARY-CLI-SET-001: 关系参数按来源分组并绑定摘要

Tests:
- `test:0acf66749aca8c1ed1586d5b030a02ce2ec903b30c1d67dd8c1ed588cc8f384f`

Tags:
- `investigation-report`

Contract:
- set-relations 的 source、relation 和 summary 参数按来源组构成完整替换。

Proves:
- 解析两个 source 组，首组的目标与摘要保持绑定，第二组显式清空且 preflight 为 true。
