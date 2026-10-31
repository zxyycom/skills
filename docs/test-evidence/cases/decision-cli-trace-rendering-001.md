### Case DECISION-CLI-TRACE-RENDERING-001: Decision Trace 分流终端图与 JSON

Tests:
- `test:19e827b7cb48c6e80265c2df6b4fc3359d4c805535c00fa1e531a65f2216c6b1`
- `test:2b986ce9af561fb7470292ecdaa14a8271cd775929f9c3c196a359a63e0150cd`
- `test:ac9dd09b1c5f0052dd0952723b8ded2ccbe739fa7f0dc58db0bd210e95ace053`
- `test:c06b4468a62010eafe2c5f425f450b05dcf8a2e8057d533f806fda9c27d3eaa2`
- `test:eee0c8cdf06eb0d0275d3ca5e3a874aa8f7705ca1b2b8f2b50797eb3c2aecf0c`

Tags:
- `decision-records`

Contract:
- Decision Trace 默认从既有选择结果渲染稳定终端关系图；文本边明确 source、type、target、可选 summary 或缺省标记，并说明只展开切片内边，显式 `--json` 保持稳定 envelope。
- trace-source 的边由节点块承接；仅 context source 的边在事件中按来源展示，同一 context source 的全部局部重划边都保留，summary 使用 JSON 字符串转义。

Proves:
- 默认图回显范围、图层、trace/context、切片内的有向边、缺省标记、frontier 与 blockedEvent，且不把切片外 relation 渲染为图内边。
- 归并和重划的 context source 边不归属到 context target；reallocation context 同时显示 Y→A、Y→B，并转义 summary 中的引号。
- `--json` 的完整 envelope 与独立手写 fixture 精确一致，退出状态成功；重复 `--json` 以参数错误退出且不写 stdout。
