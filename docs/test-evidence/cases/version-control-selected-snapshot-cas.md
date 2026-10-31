### Case VERSION-CONTROL-SELECTED-SNAPSHOT-CAS-001: 选择性快照保持完整范围CAS和恢复

Tests:
- `test:390e4b5e2c574d69a7e1db234d8bd50afd2ff94696039efdc0afcbd66cacd07a`
- `test:3de69c2d2b7125c7b1110e4076e8290639578cd4bc2994984e043ff3ca45a257`
- `test:4c40e787e2c8ebbe93eae75fde13920d04544510c2f0b4dcf05d7518214f3fae`
- `test:710ab3ff5adc67a8be87821fc8cf7e90cdc87ad19ff082391da6b4099283a4f5`
- `test:877e02c348f1e07a2de80e92a1d4c0dd199e07af4e9c616e0232f20fe2756120`
- `test:931f14c7a42e0b8484041bebd3c66e76f1190627285a644ce3b56f7efe6b9c1d`
- `test:bcb9439ce6160a4607ef7bd761d7b176ce001abbccb0563cd3bb76d32417bf6c`
- `test:bde79cee94274eebc0900afe99f30c3db3b0c92188af5b0a51fd695e96365b31`
- `test:c087e5467911d95c6a7a854638f03526e07e61d9d3ad21385af2c90c38940686`
- `test:d62c3937a5830ec724863045d5dc0a4b354422114bc3e309355d94679b8db03c`

Tags:
- `version-control`

Contract:
- opaque snapshot 绑定同一 repository 实例与 scope；锁内核对当前 HEAD，以及完整成员、表示和实际字节 CAS，显式 patch 保留未选范围。

Proves:
- scope 内外 sentinel、staged 删除和执行位被保留或精确更新；伪造或其他 repository 的 token、字节／表示／成员／HEAD 漂移及 unmerged 均被拒绝，失败不发布。
- 相同存储 OID 下实际 payload 改变仍判定漂移；写后 EACCES 恢复原 index 并保留净化失败事实。
- caller buffer 在锁内读取 revision 时改变，实际写入仍使用边界已取得的自有目标；changedPaths 与写入字节来自同一目标。
