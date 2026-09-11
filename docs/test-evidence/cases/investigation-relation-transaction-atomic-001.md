### Case INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001: set-relations atomically applies multi-source replacements and explicit clears

Tests:
- `test:518f6e02394248f7ee7967b39bd5be6d9175afce0bcc34b1afa474557e4ab19a`

Tags:
- `investigation-report`

Contract:
- 多 source 关系替换和显式清空在同一图预演后原子应用，且不会把独立 sourcePath 重投影为 ID basename。

Proves:
- 双拆分关系及各自 API relation summary 建立成功，输入摘要先 trim，Markdown 与索引保持规范投影；语义 sourcePath 保持原路径，随后可在同一调用中清空。
