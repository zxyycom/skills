### Case NATIVE-RECORD-MULTI-SOURCE-LOCAL-001: 默认配置仅属于调用目录

Tests:
- `test:ec13216c44ff0594b5612b852efbb218509c540ff7af22bb9742ff75b98fddd9`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 默认来源配置只从调用目录 .local/.investigation-report.local.json 读取，不向上查找；缺失且未显式请求配置或 key 时使用原单源查询。

Proves:
- 父目录保留可成功的多源配置，子目录保留不同的合法单源记录；从子目录调用 list 成功返回子目录记录和单源结果形状，排除错误上溯成功也被接受的假阳性。
