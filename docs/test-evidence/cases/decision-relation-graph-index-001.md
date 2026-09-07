### Case DECISION-RELATION-GRAPH-INDEX-001: 共享关系图按输入边顺序构建 source 与 target 索引

Tests:
- `test:2de687970039406142e39aee21ccaa7011aa20283b89cf74c349bbadbffaa0e9`

Tags:
- `decision-records`

Contract:
- 建图只建立全局边、source 索引和 target 索引，不隐式改变调用方提供的边顺序。

Proves:
- 三类边集合均保留各自在输入中可观察到的相对顺序。
