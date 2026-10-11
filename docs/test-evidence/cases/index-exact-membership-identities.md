### Case INDEX-EXACT-IDENTITIES-001: 精确匹配保留标量身份与空量词

Tests:
- `test:235c615563cb41782b10a3017ae0a1efdb7cd1b2c7758cc05462fc1046925eb3`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 精确匹配按类型和值区分标量，重复成员不改变集合含义；空 actual 保持量词语义。

Proves:
- 混合布尔、数字、字符串与 0/-0、多 source 重复值按独立期待命中；私有 matcher 保持空 requested 的 all/any/none 结果。
