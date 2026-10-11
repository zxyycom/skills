### Case INVESTIGATION-BATCH-DISCOVERED-SOURCES-001: 同次发现集合按唯一身份解析来源

Tests:
- `test:0fb0c05d78326d68de0032da7add14368cc087c40fc38f93c61bb67886fdf891`
- `test:75176207984ee344b72a86edc4dd6f97895e63e3a505f7869931211ed7ac1744`
- `test:b643388992af8350c37dedbd5b25e9b3e69bb22b5d739a7b2d7aa7137eb75f89`

Tags:
- `investigation-report`

Contract:
- 局部来源读取保留索引定位与必要发现，每个请求ID必须唯一解析到来源；无关集合布局错误不升级为局部门禁。

Proves:
- 移动与未索引来源在一次发现中共同解析并稳定排序，普通已索引来源继续定位读取。
- 缺失或重复身份拒绝，重复请求ID拒绝；已索引来源类型失败及发现根读取失败均不降级为成功空源。
