### Case INVESTIGATION-BATCH-DISCOVERED-SOURCES-001: 同次发现集合按唯一身份解析来源

Tests:
- `test:145d71fd8e57ed4dacd1c876ac2dc62b2579dca6dba97f5e7a025c7097483fb5`
- `test:20b8052c88e9e31acb2433e35eb2896ddfd610cda08d45a0226073ae63c340d1`
- `test:cea090b00ced1698d1fa3094c0fba08310f2fb7a3dbd6fc000d03b90b20e771f`

Tags:
- `investigation-report`

Contract:
- 局部来源读取保留索引定位与必要发现，每个请求ID必须唯一解析到来源；无关集合布局错误不升级为局部门禁。

Proves:
- 移动与未索引来源在一次发现中共同解析并稳定排序，普通已索引来源继续定位读取。
- 缺失或重复身份拒绝，重复请求ID拒绝；已索引来源类型失败及发现根读取失败均不降级为成功空源。
