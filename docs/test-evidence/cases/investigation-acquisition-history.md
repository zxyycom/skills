### Case INVESTIGATION-ACQUISITION-HISTORY-001: 关系历史只取得必要 Git 证据

Tests:
- `test:a60cadd504c0fcc4cee3e12da4dfb53c7472a67fe083be3aeda5da2db16d76ff`

Tags:
- `investigation-report`

Contract:
- 没有前序目标时不探测 Git；HEAD 无报告时空来源不扩张为全仓库读取。

Proves:
- 无关系的前序历史诊断生成零 Git trace；HEAD 只有 notes 时保留前序未记录 warning，未执行 cat-file 全仓库读取。
