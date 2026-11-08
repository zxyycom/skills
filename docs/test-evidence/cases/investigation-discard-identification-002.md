### Case INVESTIGATION-DISCARD-IDENTIFICATION-002: 同名候选与正式报告要求完整 ID

Tests:
- `test:1f3582ba2a47817bb29d520da0781f7410e5974d644891e49551fee38a400eb3`
- `test:a3aa7a386c422674fea73eae9c5da2e54dc24e0d53d77d795d109ca099e88d2e`

Tags:
- `investigation-report`

Contract:
- 候选与正式报告同名时，discard 不得静默选择删除范围。

Proves:
- 共用 identity selector 的纯测试中，两种身份同名返回歧义；真实 IR CLI discard 调用已记录候选并正确进入候选确认门禁。
- 源码的 discard 请求原样将 selector 传给共用 identity selector；此组合不声称真实 CLI 执行了同名歧义 fixture。
