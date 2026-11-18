### Case RESOURCE-LOGICAL-ENTRY-QUERIES-001: 逻辑入口与旧精确引用共存

Tests:
- `test:a222aa2d74e311a496d51b2ea7420f49d16146db41f914633790f1a152b8eccd`

Tags:
- `resource-records`

Contract:
- 逻辑入口用目录和文档路径导航，不要求路径存在，不随入口内容变化而改变记录身份；旧文件、图包成员和用途选择仍保持原有精确引用。

Proves:
- 目录和文档尚不存在时，混合记录可同步索引；list 和 show 保留两种入口的路径与类型，metadata search 按文档路径定位对应资源。
- 创建入口文档并向入口目录追加过程文件后，check 仍有效、同步无变更，show 仍返回同一当前记录。
- 同一混合数据中，旧索引版本不出现 entries；旧精确文件仍可用 show 读取，图包成员 trace 仍解析到原文件及其预览来源，集合选择仍指向原图包成员。
