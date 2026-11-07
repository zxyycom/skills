### Case NATIVE-RECORD-CLI-TXN-RESULT-001: 计划与事务结果的机器映射

Tests:
- `test:92ffa1fcfb574599e5d13d92ba869bea70a44bf166dca1e4656a2759bf9c2383`
- `test:cda16fd18260f4c40c2a923c9d054ed881ccca4fb67b9f018b2c9c4fa5d2c567`
- `test:e76697498b18960ce05ad2dc1c182b9f222098595ba33f3644eb3a285d31cbe1`

Tags:
- `record-rust`

Contract:
- 事务结果应区分成功、失败、未知路径和计划中的资源移动。

Proves:
- 局部结果验证成功不虚构验收、失败不报告 review，以及计划不冒充资源移动完成。
