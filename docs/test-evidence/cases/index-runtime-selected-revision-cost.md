### Case INDEX-RUNTIME-SELECTED-COST-001: revision 不同时跳过 state 比较

Tests:
- `test:f4f4dff8a0cfb169131723bdb3bf2e3c4c72c795191f3b5dc1eb0c82c7debe35`

Tags:
- `index-runtime`

Contract:
- revision 不同已足以识别变更；revision 相同的条目仍须比较 state。

Proves:
- 在一次完整差异比较中，revision 不同的两侧 state 未序列化，相同 revision 的两侧 state 均被比较，结果包含变化 ID。
