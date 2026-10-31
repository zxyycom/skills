### Case GATE-SELECTED-FUNCTION-BOUNDARY-001: 原生函数指标仅阻断所选领域的超限实现

Tests:
- `test:755210d3b59fe90c70b82bbe1138f73be452d480f4e2d7e1e12822eaccccce39`

Tags:
- `repository-tooling`

Contract:
- selected 的函数指标实际分析所选维护代码并执行原有角色阈值；无关领域的超限函数不得阻断当前领域，所选产品代码超过五个参数必须阻断。

Proves:
- 真实 task-graph function-metrics 与成功的隔离环境前置执行后，健康产品代码、测试区六参数函数及无关决策域六参数函数整体通过且无 finding，证明测试角色阈值及领域隔离实际生效。
- 仅将所选产品函数改为六参数后原生 Check 与 aggregate 均 failed，主数据恰有一个 blocking finding；supplemental record 精确指向所选路径、tooMany、parameter-count、上限五与实测六。
