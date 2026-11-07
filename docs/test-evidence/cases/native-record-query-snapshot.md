### Case NATIVE-RECORD-QUERY-SNAPSHOT-001: 列表、显示与追踪快照投影

Tests:
- `test:02d04ea3493daeecbcd4da2e19cba074334b88382f54c21ff14c6eadba0675a5`
- `test:2747afd346ed801104f1bb38812a87782051398d4355361ac16b735f4cb14925`
- `test:57dec937f91d20f42381884ff673493a43d2c87058cf7c09c2fce6c7c9803d8f`
- `test:7784259019830dd766ba15fb49025f52d796804442865dc134bd533eb04e7b1c`
- `test:82344a738cd4e9a87f2d168c911aa9e77626670dc907da0f71e9ee3678d9fb6f`
- `test:88fee32d8e90fbece5440bbfedec4ed02d3c1f614d23dbcf9ced78915e1abf7c`
- `test:8fc38b0078d1ddfea1f7f8b68c272611f888965e27c46498c028dd1fe1023fad`
- `test:cf57484c7542de3975c7ad2ffec03dc91e55068e0f54b53d3907db16e562a0ba`
- `test:f3e589c00f450ba7649d425982d51b6feff556a05018a8ddc62d5a1a729ae8aa`

Tags:
- `record-rust`

Contract:
- 查询结果须保留领域范围、分页和追踪的可观察事实。

Proves:
- 固定索引和源验证 list facets、show 身份及过期状态、事件预算和两域输出。
- 调查 show 保留开头 BOM 原文，以含 BOM 的指纹核对是否过期。
