### Case INVESTIGATION-INDEX-INTEGRITY-001: 不可读来源不影响合法快照 list

Tests:
- `test:2b742f4342995878846e8c45e2354e173561cb2ec4810a9a40a2c6ffc4ed56ab`

Tags:
- `investigation-report`

Contract:
- 合法发布索引的 list 不读取报告源，不证明当前工作区来源合法或对齐。

Proves:
- 来源变为不可读后 list 返回既有快照与零 error、零 warning。
