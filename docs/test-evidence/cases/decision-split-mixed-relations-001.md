### Case DECISION-SPLIT-MIXED-RELATIONS-001: Evolve 拒绝拆分与非拆分后继混合

Tests:
- `test:790f344d8da8c1c2de8d24257fe49949c0f2aa0fd7fe4724df0e411596b753a4`

Tags:
- `decision-records`

Contract:
- 多后继拆分策略要求每个所选后继都恰好保存一条拆分关系，不能把拆分后继和普通修订后继混入同一事务。

Proves:
- 纯事务准备对混合拆分候选和修订候选返回 error、exitCode=1 和纯拆分关系分布诊断，且不产生 changes。
