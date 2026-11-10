### Case NATIVE-RECORD-SOURCE-WRITE-SELECTION-001: 显式单源 key 仅写对应来源

Tests:
- `test:3270b5fc5395ba4b397ed923fda04643615fa6883021edc8283cbb52c2d02dd0`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 写操作的显式 key 展开为唯一来源时，只作用于该来源，不受读取 defaultKey 或独立 defaultWriteKey 重定向。

Proves:
- 读取默认选择双源、写入默认指向 second 时，真实 new --key one 成功，仅在 first/research/reports 创建固定日期候选，second 来源无候选且调用工作区不创建 docs。
