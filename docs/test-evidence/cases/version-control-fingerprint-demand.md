### Case VERSION-CONTROL-FINGERPRINT-DEMAND-001: 真实消费者的完整payload指纹需求

Tests:
- `test:43fb3c9b9aafcb790ae48f08ec5750b4e086609175614f458fec8896fb96242b`
- `test:5a13f56fd4c4a36337a48f1a24fa6a8e9ccb9e22a7a3ca3cfb73c46163e3672e`

Tags:
- `version-control`

Contract:
- 普通完整读与prefix仅消费内容和size；opaque pending snapshot依赖全部unique实际payload指纹。

Proves:
- 真实full-read、prefix与默认pending读取不调用Hash.update且字节/complete正常；重复OID完整读只返回唯一对象。
- snapshot仅保留所选内容，仍hash全部unique实际payload的总bytes；默认selection返回非空SHA256指纹，包括零保留对象。
