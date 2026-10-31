### Case GATE-EMPTY-CODE-METRICS-001: 预期代码领域的空输入不伪装为通过或 flag 禁用

Tests:
- `test:b1c62300db68959ea1011a85f06fb08d3b4db12d8df69132ac9b4c19f38cadca`

Tags:
- `repository-tooling`

Contract:
- 已启用代码领域但没有可维护代码输入时，指标必须保留 no-eligible-input 事实，不能把所有空选集改为 passed，或混同声明领域的 flag 禁用。

Proves:
- 私有文件树只有无关决策域源码；所选 task-graph 的两项真实指标文件声明均收集为空，没有回退到全仓代码。
- 使用 task-graph flag 运行两项原生指标后，均为 not-applicable 且 reason 精确为 no-eligible-input；测试的严格聚合器结算 failed，不接受空输入的成功替代。
