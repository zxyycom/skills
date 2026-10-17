### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-002: JEV 载体编译与结构保真

Tests:
- `test:2b2831ad651f6275c6d51403c5caa6231e9d8410f923e08d10f6e91f9f82c5c6`

Tags:
- `lightweight-judgment`

Contract:
- 直接 `openai-decisions` 的原生数组合同编译保留 state 和题目局部结构、原问题顺序、字符串候选身份、Noul 极性及 Score 等级原序；不适用于 OR 的 answers map 合同。

Proves:
- 独立 golden 断言核对数字形键与原型同名键、null 描述省略、结构化字段完整 JSON、false-only criteria、空 Score 标签和独立 carrier。
