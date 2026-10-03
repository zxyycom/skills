### Case LIGHTWEIGHT-JUDGMENT-CLI-015: 短密钥与输出边界

Tests:
- `test:2b9b9db769d114c47326d213f9a49d01cb1978e95ea9ae6f90ff7c37ad2ec674`

Tags:
- `lightweight-judgment`

Contract:
- 凭据只用于鉴权，不参与 JSON token 或字段名替换；doctor 只消费存在性。

Proves:
- true、a 与含转义的假密钥下，doctor 与推理 JSON 均可解析且保留布尔、字段和实际 model；network 异常只输出稳定诊断。
