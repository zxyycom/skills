### Case INVESTIGATION-CANDIDATE-PUBLISH-004: publish preflight validates complete merge and split batches

Tests:
- `test:493d3f3aefb5ee5f66a6075da3df42762f650dab1175e74a359035bb4d76e217`

Tags:
- `investigation-report`

Contract:
- 首次集合的 `publish --preflight` 只接受由同批 selected candidates 完整闭合的归并或拆分关系图，并保持零写入。

Proves:
- 未选择归并的直接前序时，预检拒绝该 candidate。
- 完整选择归并前序或同一拆分的两个后继时，预检通过且不会建立正式报告。
