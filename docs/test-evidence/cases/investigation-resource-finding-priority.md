### Case IR-RESOURCE-FINDING-PRIORITY-001: 有界明细保留重点且分类汇总不截断

Tests:
- `test:5a9cc2aa8f5f29dbf29700cef09a5dc6873264bdcb38db4bdd80c8bc64d40500`
- `test:e457fcda9318c53e9d706b49042990c7f8d1ba4323c3b8066a7f8fcfd18bcdc6`
- `test:f49bd3b0d6ef2b67896978d6e546a6c68d74905679488ddd58f50170aa685567`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 明细按覆盖、级别及信号优先级有界保留，分类计数包含被省略明细；CLI 先给摘要，资源提示按优先级只输出一次且限制控制台明细条数。

Proves:
- 132 条压缩启发之后加入的未完成、确定副本和大小提示仍位于保留明细前列；128 项明细、8 项省略及 135 warn／1 info 总数一致，CLI 验证摘要、排序与单次输出；17 项完整 JSON 明细在控制台仅展示 12 项并引导回读，其余 5 项不混为 JSON 截断。
