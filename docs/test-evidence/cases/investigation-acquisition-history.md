### Case INVESTIGATION-ACQUISITION-HISTORY-001: 关系历史只取得必要 Git 证据

Tests:
- `test:f4cb7f0fb8d51e9a3fc8dbe015dc329a4181a9865e49cfa7fd7576fe8c3cf366`

Tags:
- `investigation-report`

Contract:
- 没有前序目标时不探测 Git；HEAD 无报告时空来源不扩张为全仓库读取。

Proves:
- 无关系的前序历史诊断生成零 Git trace；HEAD 只有 notes 时保留前序未记录 warning，未执行 cat-file 全仓库读取。
