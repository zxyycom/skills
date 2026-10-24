### Case INVESTIGATION-STRICT-PREPARATION-FACTS-001: 局部事务各阶段保留独立来源证明

Tests:
- `test:201280ab4145d37785622d853e16ea834d2158252717882c4a0cc030b94e9fe2`
- `test:697df99a8736aae00b9b07a0310ef2828ab451d381b4d2832750cb5d437c10e4`
- `test:b1d42e473d020172cec74156de1d6e1e85a4fdd4f3092b8948e3c84a6435a23a`
- `test:ca700502919d37c015ab9bbf011da68bf143ebe8f2899dbbce050b4b039df69e`
- `test:e47af9d8ee498817e19658dbb95dbad3a794d686cab0bb3ac0c4622acebdb1ac`

Tags:
- `investigation-report`

Contract:
- rename 与正式 discard 只采集所选及实际改写来源并将安全 snapshot 交给事务；写后独立读取实际写集和目标索引，未选来源不进入当前性验收。

Proves:
- 正式 rename 准备仅打开实际改写来源一次，候选 rename 的有限发现与事务采集各一次；guards 与 write before 复用所属安全 snapshot，未选正式来源为零读取。
- 正式 discard 在 beforePublish 时只采集目标一次，无关来源直到完成均为零读取。
- 直接 rename 写后验收每份实际改写来源独立读取一次；后来编辑真实写集被明确拒绝，不借用准备字节掩盖漂移。
