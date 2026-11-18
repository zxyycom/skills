### Case RESOURCE-LOGICAL-ENTRY-VALIDATION-001: 逻辑入口的版本形态与路径拒绝

Tests:
- `test:209b6494ef46c1ceeb1733f3d8e11e0814422fea70dd809a0dc90d1f2f09f88f`
- `test:2df6c0feb447e2a612a8a30b20db7e695c44913c0afaf980eeb9e7b65ce55e4b`
- `test:72efe911d4bd213ecd63a90f4e018fb48d555e5119769af9bcf81a92aceef408`

Tags:
- `resource-records`

Contract:
- 逻辑入口是非空的目录或文档入口数组，不能与同版文件或图包成员混用；工作区相对路径约束适用于每一项。

Proves:
- 空 entries、入口与文件同版、入口与成员同版均被 sync-index 按源文件和非空／互斥规则拒绝。
- 显式 null、非法 file kind 和未知字段分别按源文件及具体解析原因被拒绝。
- 第一项目录路径合法、第二项文档路径越出工作区时，同步返回领域错误，定位该源文件的 entries[1].path。
