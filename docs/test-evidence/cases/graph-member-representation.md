### Case GRAPH-MEMBER-REPRESENTATION-001: 不同稳定 direct 单位共享一份完整成员表示

Tests:
- `test:7604c4e5c8afbe9c47110156fc9612f96cccdaf9e127eab373df8a1c04e67142`

Tags:
- `performance`

Contract:
- 单次 trace 内证明稳定成员数组后可复用私有成员事实，不为每个 direct 单位复制完整成员。

Proves:
- R=U=10/100/300 时同成员数组仅证明 R 个槽，规范化仅保留一份 R 槽数组与共享身份后缀，同时保留每个不同 direct 集合。
