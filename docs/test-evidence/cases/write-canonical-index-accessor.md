### Case WRITE-CANONICAL-CASE-013: 访问器排序定义保留动态语义

Tests:
- `test:1879d96bd93668bcb43876829d47c9c758d9d28aa4758b7db332b2bae2898ef6`

Tags:
- `write-canonical`

Contract:
- 冻结访问器定义不可作为稳定排序规则复用资格。

Proves:
- 真实同步期间改变访问器值，验证原序列化字段顺序。
