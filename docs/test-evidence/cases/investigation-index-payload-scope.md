### Case IR-INDEX-PAYLOAD-SCOPE-001: 所有 stage scope 仅消费必要 payload

Tests:
- `test:320c3dd0f5c6a92c313088ae55b2d1a3e3deb1120daa56ef71f31e80a7dd494a`

Tags:
- `investigation-report`

Contract:
- 各 scope 按所选对象消费必要 payload；未选 pending 路径、模式与 OID 保持，不保证其 blob 当前可读。

Proves:
- 删除无关 pending blob 后 all、domain、index 均能完成所选刷新；无关条目完整身份保持，重复选择 unchanged。
