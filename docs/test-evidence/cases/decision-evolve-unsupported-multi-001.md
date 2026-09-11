### Case DECISION-EVOLVE-UNSUPPORTED-MULTI-001: Evolve 拒绝未获策略支持的普通多后继形状

Tests:
- `test:a74dac1a7da45b121c7b49109615ed90a3238667c07cd29e6b158dc32220271d`

Tags:
- `decision-records`

Contract:
- 当前只有闭合拆分策略允许多后继；空关系或普通非拆分关系不能组成未经定义的多后继事务。

Proves:
- 同时选择两个空关系候选时，evolve 在写入前报告多后继只受闭合拆分策略支持。
