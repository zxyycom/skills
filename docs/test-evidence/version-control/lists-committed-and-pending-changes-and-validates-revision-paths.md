### Case VERSION-CONTROL-CHANGES-001: 列举已提交与 pending 变化并验证修订路径
Entry:
- `tools/shared/tests/version-control.test.ts > lists committed and pending changes and validates revision paths`
- `bun test --test-name-pattern="^lists committed and pending changes and validates revision paths$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 变化列表必须明确比较边界，并拒绝逃逸路径和不存在的修订。
Proves:
- 已提交与 pending 差异分别准确返回，非法路径和修订映射为稳定错误码。
