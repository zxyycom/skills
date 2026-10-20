### Case DECISION-EVOLVE-UNSUPPORTED-MULTI-001: Evolve 拒绝未获策略支持的普通多后继形状

Tests:
- `test:a74dac1a7da45b121c7b49109615ed90a3238667c07cd29e6b158dc32220271d`

Tags:
- `decision-records`

Contract:
- 空关系或普通非拆分关系不能组成未经定义的多后继事务；闭合拆分及重划按各自策略校验。


Proves:
- 纯事务准备对两个空关系候选返回 error、exitCode=1 和闭合拆分策略诊断，且不产生 changes；此入口不覆盖合法重划策略。
