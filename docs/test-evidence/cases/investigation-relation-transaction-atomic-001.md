### Case INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001: 关系替换与显式清空写入规范投影

Tests:
- `test:233a2f8b8fcd744d531492f8922264cb685dd6adbcbd0ea302d65c8021a0c281`

Tags:
- `investigation-report`

Contract:
- 多 source 关系替换和显式清空在同一图预演后原子应用，且不会把独立 sourcePath 重投影为 ID basename。

Proves:
- 双拆分关系及各自 API relation summary 建立成功，输入摘要先 trim，Markdown 与索引保持规范投影；语义 sourcePath 保持原路径，随后可在同一调用中清空。
