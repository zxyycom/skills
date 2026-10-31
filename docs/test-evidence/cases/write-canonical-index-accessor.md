### Case WRITE-CANONICAL-CASE-013: 访问器排序定义保留动态语义

Tests:
- `test:240a9ec9ba0f794294cec808693e2d1942acec823238bfd27fa389e1689dd505`

Tags:
- `write-canonical`

Contract:
- 冻结访问器定义不可作为稳定排序规则复用资格。

Proves:
- 真实同步期间改变访问器值，验证原序列化字段顺序。
