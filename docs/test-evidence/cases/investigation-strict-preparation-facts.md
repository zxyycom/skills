### Case INVESTIGATION-STRICT-PREPARATION-FACTS-001: rename 写后只读实际改写来源

Tests:
- `test:0e985b2ed0b5aae33f742987e1ba82045aad752d507d46ab8a1c164655e6e7c2`
- `test:201280ab4145d37785622d853e16ea834d2158252717882c4a0cc030b94e9fe2`
- `test:697df99a8736aae00b9b07a0310ef2828ab451d381b4d2832750cb5d437c10e4`
- `test:ca700502919d37c015ab9bbf011da68bf143ebe8f2899dbbce050b4b039df69e`
- `test:e47af9d8ee498817e19658dbb95dbad3a794d686cab0bb3ac0c4622acebdb1ac`

Tags:
- `investigation-report`

Contract:
- rename 与正式 discard 只采集所选及实际改写来源并将安全 snapshot 交给事务；写后独立读取实际写集和目标索引，未选来源不进入当前性验收。

Proves:
- hook 后写后阶段对每个实际改写来源各读一次；不将总计数解释为未观测的完整 index 或全流程读取义务。
