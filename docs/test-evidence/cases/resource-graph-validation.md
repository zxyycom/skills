### Case RESOURCE-GRAPH-VALIDATION-001: 引用、身份与图约束

Tests:
- `test:0be36ac5413a269b7bacf92c9e3747632684e61b9fcec03870e0632d25ffc986`
- `test:4ffd93116201a9030d0702f0ecde56bf8dcce5e47ef5e6cfad1d1149864c991f`
- `test:75bcf81d1c72a6befdfaee213878f8dcfc25f4199cb5fbb5b0566c083e66f456`
- `test:c1b75d32c1f97bcab44168ded5388a3263d32cf74c5cde05d32bed00f4acd2aa`

Tags:
- `resource-records`

Contract:
- 依赖图及集合有向无环，精确引用与选择范围有效，版本和成员身份唯一；人工参考不纳入依赖环。

Proves:
- 拒绝循环、悬空、图包成员指向成员、越域选用与重复身份；接受同目标不同作用和人工参考；节点及边限制产生有界截断。
