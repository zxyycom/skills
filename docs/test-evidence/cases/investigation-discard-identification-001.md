### Case INVESTIGATION-DISCARD-IDENTIFICATION-001: discard 识别正式报告并拒绝缺失目标

Tests:
- `test:1f3582ba2a47817bb29d520da0781f7410e5974d644891e49551fee38a400eb3`
- `test:a3aa7a386c422674fea73eae9c5da2e54dc24e0d53d77d795d109ca099e88d2e`
- `test:bfc8a2107b179a5b9d77513e890c07bc7f9c82ffabb7f10f65a2dc1ad21bb9de`

Tags:
- `investigation-report`

Contract:
- discard 按调查身份定位正式报告或候选，缺失日期 ID 不能回退到其他同名身份。

Proves:
- 正式报告仍有引用时实际操作定位目标并拒绝提交；真实 CLI 对已记录候选进入候选确认门禁。
- 共用 identity selector 的纯测试拒绝不存在的日期 ID；CLI 的 selector 按源码原样传入该选择器。本组合不宣称在真实 CLI 运行了全部缺失身份变体。
