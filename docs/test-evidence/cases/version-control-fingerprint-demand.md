### Case VERSION-CONTROL-FINGERPRINT-DEMAND-001: 普通读取不计算未消费的指纹

Tests:
- `test:e3007a700d92393cf075b3bd0427bc35443d3dddfdef4f8f715eef448f69f0e1`

Tags:
- `version-control`

Contract:
- 普通完整读与 prefix 仅消费内容和 size，不计算未被调用方消费的指纹。

Proves:
- 真实full-read、prefix与默认pending读取不调用Hash.update且字节/complete正常；重复OID完整读只返回唯一对象。
