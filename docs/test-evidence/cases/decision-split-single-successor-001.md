### Case DECISION-SPLIT-SINGLE-SUCCESSOR-001: Evolve 拒绝单后继拆分

Tests:
- `test:e04f768491c8ba7236aa1d23523a9e5ebb3060fbd10fa7c0c3a03619fd346752`

Tags:
- `decision-records`

Contract:
- `拆分` 是至少包含两个显式后继的闭合一对多策略，单后继不能通过来源关系重新挂接粗前序。

Proves:
- 纯事务准备对仅选择一个带拆分关系的候选返回 error、exitCode=1，诊断至少需要两个显式 successor，且不产生 changes。
