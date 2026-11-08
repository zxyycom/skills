### Case RECORD-SEARCH-OUTPUT-001: 原生搜索的默认与机器输出

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`

Tags:
- `record-search`

Contract:
- 原生普通搜索默认输出可读的多行 JSON 结果；`--json` 输出单行机器结果对象。

Proves:
- 真实 Decision CLI 的 metadata 搜索分别以默认和 `--json` 执行；默认输出可解析且有缩进行，等于紧凑 envelope 的 result，机器输出恰一行。
- 此节点不验证 Investigation、trace 或 warning 通道。
