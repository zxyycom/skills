### Case NATIVE-RECORD-MULTI-SOURCE-CONFIG-001: 本地配置按组选择及相对路径定位

Tests:
- `test:e3f290d3bdf784d2340ee4ccaf8e2cd30e9fa2a0fca582f77099782ddaeb0766`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 调查 list/search 从调用目录默认配置或显式 --config 选择文件，使用显式 --key 或 defaultKey；每源 root 相对配置文件目录。

Proves:
- 真实 CLI 分别选择默认组、非默认 key 和另目录显式配置中的非默认 key，并从各源真实索引返回对应记录，防止忽略配置路径或把 root 错按 cwd 解释。
