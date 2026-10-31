### Case GATE-COMPLETE-CODE-METRICS-001: 完整模式保留全量维护代码与跨领域阻断

Tests:
- `test:dbbae5c63eb9d0f46000db3ad9c894d9aaad4a329986cc35a951550dbee30ca4`

Tags:
- `repository-tooling`

Contract:
- changed、full 与 release 的 file/function metrics 保持全量 scripts/tools 维护代码策略，技能生成副本不进入指标；任何领域的产品函数违反原有阈值都必须阻断。

Proves:
- 三种真实 Definition 的两项指标 options 均经 collectProjectFiles 选中 task-graph、决策源码与 scripts/lib 实现，并排除同树的技能生成副本。
- 每种模式均实际执行原生 function-metrics；决策域六参数函数使 Check failed，唯一 finding 精确指向该路径、tooMany、parameter-count、上限五与实测六。
