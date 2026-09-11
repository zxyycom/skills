### Case VERSION-CONTROL-CHANGES-001: 列举已提交与 pending 变化并验证修订路径

Tests:
- `test:6543807777af4da6fb2d6b8f5f62016393fa2cb2cd255c7a43bffd43ff91656d`

Tags:
- `version-control`

Contract:
- 变化列表必须明确比较边界，并拒绝逃逸路径和不存在的修订。

Proves:
- 已提交与 pending 差异分别准确返回，非法路径和修订映射为稳定错误码。
