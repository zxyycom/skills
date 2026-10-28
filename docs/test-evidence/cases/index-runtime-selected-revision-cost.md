### Case INDEX-RUNTIME-SELECTED-COST-001: revision 不同时跳过 state 比较

Tests:
- `test:a552d7367c16102d745e4d2fd0177daaec54ff9be8173fc41da6d76a3771e6e1`

Tags:
- `index-runtime`

Contract:
- revision 不同已足以识别变更；revision 相同的条目仍须比较 state。

Proves:
- 在一次完整差异比较中，revision 不同的两侧 state 未序列化，相同 revision 的两侧 state 均被比较，结果包含变化 ID。
