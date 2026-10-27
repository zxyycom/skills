### Case GATE-SELECTED-ARGUMENTS-001: 显式能力组按首次顺序追加去重

Tests:
- `test:b58980379a243e5da2ff5382e5b97c74ce3861893f9ea926836623485da30af9`

Tags:
- `repository-tooling`

Contract:
- 重复 --scope 能力组形成 selected 调用，保留首次出现顺序；开头单个 Bun 参数分隔符兼容已有调用。

Proves:
- gate-tests、mcpshell、重复 gate-tests 与诊断选项解析为去重的两组；有无前导 -- 均得到同一调用，legacy changed 仍可带分隔符。
