### Case VIDEO-CONFIGURATION-PRECEDENCE-001: 位置配置按字段继承且媒体缺省延迟解析

Tests:
- `test:efc94176d75db53aa799838a5c44ef3ee23684c1e8acc1feaf10037c97f9c7c4`
- `test:f8e8b8fe418fcb74a97a62f81c3ec99321eadafd72bd9405e327de235e4b1703`

Tags:
- `video-understanding`

Contract:
- 显式 CLI、显式项目配置、用户配置和适配缺省按字段优先；省略/null 继承低层，路径不插值，媒体 resolver 仅在新媒体操作需要时调用。

Proves:
- 字段独立合并且配置字节不改；fixture 按实际来源路径计算证据集合身份，Node 公开入口按预期选择证据根和媒体根，纯复用不调用 resolver，新媒体保留其 runtime target 与失败身份。
