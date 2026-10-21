### Case INVESTIGATION-STAGE-RESOURCE-ADD-001: 选择性索引投影隔离未选报告资源与元数据

Tests:
- `test:50d847a909fd5ca8c332abe1fbb871cfdf96edf619d81d1c8d54685f7cc33750`

Tags:
- `investigation-report`

Contract:
- 未选报告的资源变化不自动进入已选报告 index entry。

Proves:
- 对 first/second 同时发生元数据变化且 second 声明资源的快照，仅选择 first 时，生产索引投影的 first entry 等于工作区版本，second entry 仍等于基线版本。
