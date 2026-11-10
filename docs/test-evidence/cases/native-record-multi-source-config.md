### Case NATIVE-RECORD-MULTI-SOURCE-CONFIG-001: 本地配置按组选择及相对路径定位

Tests:
- `test:0847b8443954c4a4cf257f5f71c8374a4f5fce31c681320dd1d339d63e573efa`
- `test:e3f290d3bdf784d2340ee4ccaf8e2cd30e9fa2a0fca582f77099782ddaeb0766`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 调查 list/search 从工作区项目／本地配置或显式 --config 选择统一设置，使用显式 --key 或 defaultKey；对象按字段覆盖、来源组数组整体替换，每源 root 在所属配置文件目录解析。

Proves:
- 真实 CLI 分别选择默认组、非默认 key 和另目录显式配置中的非默认 key，并从各源真实索引返回对应记录，防止忽略配置路径或把 root 错按 cwd 解释。
- 项目与本地分别声明的来源组同时保留且相对路径各自正确，本地 defaultKey 生效；同名组被本地单来源数组整体替换，不拼接项目数组。
