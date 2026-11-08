### Case INVESTIGATION-CANDIDATE-PUBLISH-001: publish preflight establishes only explicit candidates

Tests:
- `test:5d9d0c9b23d9e8d91b0e428446e1d0a4022c3c5f7fe476289be94941693a3d4f`

Tags:
- `investigation-report`

Contract:
- publish 只建立所选候选，并在预检中保持只读。

Proves:
- 预检选中两个具有关联的候选且不创建正式报告；正式执行建立两个报告、移除已选候选并保留无关非法候选。
