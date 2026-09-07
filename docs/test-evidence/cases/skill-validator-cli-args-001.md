### Case SKILL-VALIDATOR-CLI-ARGS-001: Validator CLI 帮助与参数错误稳定

Tests:
- `test:8c455add0ac27ccdecbf2000c9f75d27160c80393c3183ae41a718fb7402912b`

Tags:
- `skill-validator`

Contract:
- Validator CLI 的帮助和参数数量错误必须使用稳定退出契约。

Proves:
- Help 成功输出用法，多余参数以参数错误退出。
