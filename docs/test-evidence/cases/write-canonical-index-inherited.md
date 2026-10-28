### Case WRITE-CANONICAL-CASE-014: 继承排序定义保留动态语义

Tests:
- `test:862697f7ba2932c99b914a149e8bbbdfeb59296b36eb334a2ce0ab6583e03183`

Tags:
- `write-canonical`

Contract:
- 继承的排序定义不可作为自身稳定数据属性复用资格。

Proves:
- 真实同步期间改变继承值，验证原序列化字段顺序。
