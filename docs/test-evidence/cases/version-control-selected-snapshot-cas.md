### Case VERSION-CONTROL-SELECTED-SNAPSHOT-CAS-001: 选择性快照保持完整范围CAS和恢复

Tests:
- `test:02cea973e4dc42ec4ccaa42beef7aa32d713bdae68be27e4572307595b2ca5ab`
- `test:4074fc16bf97b41d883425da3cda213a3ff1d4550473ebd0128e4981a2196554`
- `test:7c759f14e952a441f9429dcb1d0e7c5627881777a561d53546cdb1eecf14f30b`
- `test:85836b2aa4291ccac03f6f6cb8043940e47d73781990df44288cfadb6d31cda7`
- `test:bbc58f5dfeea671677e4753a96be42eef4fd2f7a8ed5c49141d192b34d16133c`
- `test:bc40d154ba1cfaf75c5c3df1ba135a0d0d9241484489b63eaa15c51c813baefc`
- `test:c568635de67fe78fd524394e8f825484d231626a627aa5db5934baff28fdd175`
- `test:ee7cd34b26888e3c7c19d73838991b6166cb01fd9188d4762c1b34d5440ef49a`
- `test:f5e323362880130a576e9c67682b0bd953ec53b104b7f3079ece78392e7bc507`
- `test:fc3252530a356729d58a4f4adc1242bdd54585356c9ada01924d278936e27784`

Tags:
- `version-control`

Contract:
- opaque snapshot 绑定同一 repository 实例与 scope；锁内核对当前 HEAD，以及完整成员、表示和实际字节 CAS，显式 patch 保留未选范围。

Proves:
- scope 内外 sentinel、staged 删除和执行位被保留或精确更新；伪造或其他 repository 的 token、字节／表示／成员／HEAD 漂移及 unmerged 均被拒绝，失败不发布。
- 相同存储 OID 下实际 payload 改变仍判定漂移；写后 EACCES 恢复原 index 并保留净化失败事实。
- caller buffer 在锁内读取 revision 时改变，实际写入仍使用边界已取得的自有目标；changedPaths 与写入字节来自同一目标。
