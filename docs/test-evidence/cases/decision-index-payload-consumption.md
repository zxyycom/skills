### Case DR-INDEX-PAYLOAD-CONSUMPTION-001: index只验收所消费payload，all和domain保留完整验收

Tests:
- `test:cba34bb14710f8cfd3087074144f73046c4b96f5fb061302111cbe25ab4545b3`

Tags:
- `decision-records`

Contract:
- Decision index只验收目标索引payload，但保留全域pending成员身份；all/domain仍验收全域payload。

Proves:
- 删除未选正文的Git对象后，all/domain失败且不写pending；index成功刷新所选投影，所有非索引成员保持原mode/OID，重复操作unchanged。
