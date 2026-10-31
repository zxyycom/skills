### Case WRITE-CANONICAL-CASE-014: 继承排序定义保留动态语义

Tests:
- `test:b7f881f2348782847b082655e340c81cbf658516d2c6994c939d2508f397f1c2`

Tags:
- `write-canonical`

Contract:
- 继承的排序定义不可作为自身稳定数据属性复用资格。

Proves:
- 真实同步期间改变继承值，验证原序列化字段顺序。
