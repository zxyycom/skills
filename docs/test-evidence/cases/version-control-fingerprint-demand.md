### Case VERSION-CONTROL-FINGERPRINT-DEMAND-001: 普通读取不计算未消费的指纹

Tests:
- `test:43fb3c9b9aafcb790ae48f08ec5750b4e086609175614f458fec8896fb96242b`

Tags:
- `version-control`

Contract:
- 普通完整读与 prefix 仅消费内容和 size，不计算未被调用方消费的指纹。

Proves:
- 真实full-read、prefix与默认pending读取不调用Hash.update且字节/complete正常；重复OID完整读只返回唯一对象。
