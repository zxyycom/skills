### Case RESOURCE-LOGICAL-ENTRY-MEMBER-001: 逻辑版本与精确成员的引用边界

Tests:
- `test:4b7261dcdc92d56615578ea8cda513dcb0c22cb57e7dffc97fcc34173aadf038`
- `test:96437365e09c6c9a65acf56661c626cb8ff813a61a93030d69d34dc2531e53b8`
- `test:dbd600dd58eb2382c3085b15bfb0d573c8eed20d7e25a8374ba69a75d03145f9`
- `test:fe146b9a848d0e8af9a1b276b0bf2d6a4d0a24f88763cbb05858095ba4053b3b`

Tags:
- `resource-records`

Contract:
- 逻辑入口路径尾段不是精确成员键；用途选择可以引用整个逻辑版本，也可以保留独立的精确图包成员引用。

Proves:
- show --version 返回逻辑入口；以该入口路径尾段执行 show --member 返回成员不存在。
- 用逻辑入口路径尾段作为 member 构造图包成员目标或文件关系目标，均以各自来源记录和目标诊断被拒绝，而不是把导航入口当精确文件。
- 集合可同时同步并回读逻辑版本选择和独立的精确图包成员选择；给逻辑版本选择加上伪成员后，同步指出对应槽位的目标缺失。
