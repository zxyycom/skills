### Case GATE-MARKDOWN-PROOF-COLLECTION-001: Markdown 内容证明的目录读取失败

Tests:
- `test:7dff8d025a7bd50368f05a2233f0112ddadbb2839fb59bd3539dd5875f15ae1e`

Tags:
- `repository-tooling`

Contract:
- 原生 Markdown 扩展域的必要目录读取失败必须可定位地扩大执行，不能作为稳定空集合。

Proves:
- 无权限读取额外目录时计划为 fallback，摘要含该相对目录并执行 lint；root/Windows 显式跳过。
