### Case IR-INDEX-PAYLOAD-SCOPE-001: 所有 stage scope 仅消费必要 payload

Tests:
- `test:205e6fdc98bd169f4b30bbf5edbd2c77a21869d13134f72bd0e282ceeab83ff9`

Tags:
- `investigation-report`

Contract:
- 各 scope 按所选对象消费必要 payload；未选 pending 路径、模式与 OID 保持，不保证其 blob 当前可读。

Proves:
- 删除无关 pending blob 后 all、domain、index 均能完成所选刷新；无关条目完整身份保持，重复选择 unchanged。
