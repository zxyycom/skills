### Case VERSION-CONTROL-CONTENT-PAYLOAD-FAILURE-001: 所选payload各阶段读取失败阻断

Tests:
- `test:8024ef232c700d4b3849330f3cd7f3cd5047ef5faf0d0ae22ac863e30630e1e7`
- `test:81ff24ea594d59a5d13dba856f60a31990ceefbcae86d6db49c64367a7899dd3`
- `test:e9f25eef015b6c6fbfc790a93ed3e6db741fbf0c57853715fe06d77a95d4ec7b`

Tags:
- `version-control`

Contract:
- content-paths的所选payload在初始读取、锁内复核和写后检查均必须可读；失败不能伪装为合法空内容或成功发布。

Proves:
- 所选保留对象缺失在读取、锁内、写后阶段均被拒绝；锁内和写后失败保留原index并清理本事务lock。
