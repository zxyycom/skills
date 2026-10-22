### Case VERSION-CONTROL-CONTENT-PAYLOAD-FAILURE-001: 所选payload各阶段读取失败阻断

Tests:
- `test:4480822c5bc40bd0d96175542abfc3c3d741136ac990c70ed1a8436527b2a105`
- `test:469ffde31f2085248c060d07039767f2269f8ee73e8c332ef8ccee91c2fb09ca`
- `test:8497897c7be0e2bdd1d71c76ad91d6a71dbc75e85bcea5a26cc147c8f6280596`

Tags:
- `version-control`

Contract:
- content-paths的所选payload在初始读取、锁内复核和写后检查均必须可读；失败不能伪装为合法空内容或成功发布。

Proves:
- 所选保留对象缺失在读取、锁内、写后阶段均被拒绝；锁内和写后失败保留原index并清理本事务lock。
