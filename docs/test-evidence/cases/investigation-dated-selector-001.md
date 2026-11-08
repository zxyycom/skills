### Case INVESTIGATION-DATED-SELECTOR-001: 调查 selector 的日期 ID 与歧义

Tests:
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`

Tags:
- `investigation-report`

Contract:
- 日期 ID 支持 .md 后缀精确匹配；重名 selector 不得静默选择。

Proves:
- 日期 ID 带大写 .MD 后缀可匹配，两个日期同名返回歧义，缺失日期 ID 返回未找到。
