### Case VERSION-CONTROL-CHANGES-001: 列举已提交与 pending 变化并验证修订路径

Tests:
- `test:58b6dca78109e7229a85a53a087c7e7406519db4c4cc71c9aa58ea8e03a358d6`

Tags:
- `version-control`

Contract:
- 变化列表必须明确比较边界，并拒绝逃逸路径和不存在的修订。

Proves:
- 已提交与 pending 差异分别准确返回，非法路径和修订映射为稳定错误码。
