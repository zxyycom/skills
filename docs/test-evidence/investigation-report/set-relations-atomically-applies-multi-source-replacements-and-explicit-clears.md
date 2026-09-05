### Case INVESTIGATION-RELATION-TRANSACTION-ATOMIC-001: set-relations atomically applies multi-source replacements and explicit clears

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations atomically applies multi-source replacements and explicit clears`
- `bun test --test-name-pattern="^set-relations atomically applies multi-source replacements and explicit clears$" ./tools/investigation-report/tests/run.ts`

Contract:
- 多 source 关系替换和显式清空在同一图预演后原子应用，且不会把独立 sourcePath 重投影为 ID basename。

Proves:
- 双拆分关系及各自 API relation summary 建立成功，输入摘要先 trim，Markdown 与索引保持规范投影；语义 sourcePath 保持原路径，随后可在同一调用中清空。
