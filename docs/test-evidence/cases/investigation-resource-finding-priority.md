### Case IR-RESOURCE-FINDING-PRIORITY-001: JSON 明细完整且终端预览聚焦重点

Tests:
- `test:2c2d9d002b5772b2ff793be4200fe29f5682daf565a1e2dc134a2c3c2c4ca7ac`
- `test:5a9cc2aa8f5f29dbf29700cef09a5dc6873264bdcb38db4bdd80c8bc64d40500`
- `test:f49bd3b0d6ef2b67896978d6e546a6c68d74905679488ddd58f50170aa685567`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 本次产生的 findings 按优先级完整返回，不受终端预览条数限制；分类汇总与完整明细一致，终端提示有界且只输出一次。

Proves:
- 136 项明细及 135 warn／1 info 总数一致，所有 132 条压缩启发和末尾低优先级 info 均保留，未完成、确定副本和大小提示优先。
- CLI 对 129 个微小二进制资源产生的 131 项 findings 完整返回且 omittedFindings=0，终端仅展示 12 项并引导回读其余 119 项。
