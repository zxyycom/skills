### Case VERSION-CONTROL-PENDING-PAYLOAD-EXPANSION-IDENTITY-001: payload 扩展拒绝外来或不兼容快照

Tests:
- `test:3a9699b3f18e48ed68dd6e6b86111e9820976bcd564d7dddd4afdd14dea2a700`

Tags:
- `version-control`

Contract:
- 扩展比较必须绑定原始 opaque snapshot、同一 repository 实例、scope 和 content-paths 策略。

Proves:
- 克隆对象、不同 scope、默认完整 payload 策略和另一 repository 实例的原始快照不能作为兼容扩展。
