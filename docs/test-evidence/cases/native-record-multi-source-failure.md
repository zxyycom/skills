### Case NATIVE-RECORD-MULTI-SOURCE-FAILURE-001: 首源失败仍保留后续查询结果

Tests:
- `test:b00460d364575863b5ca633ecd5269db69b952f8c354618cdccc00a8639917d4`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 多源查询在单个来源失败后继续读取其他来源，整体非零退出并保留失败来源定位与错误。

Proves:
- 首源索引缺失时退出 1，失败 envelope 保留首源 root、目录及 index-not-found，并保留第二来源真实命中和成功状态，不把失败来源视为合法空结果。
