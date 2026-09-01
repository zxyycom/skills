### Case TEST-EVIDENCE-UPGRADE-V2-001: V2 Consumer 升级到固定 Topic Catalog
Entry:
- `tools/test-evidence/tests/catalog.test.ts > documented v2 consumer upgrade produces the fixed topic catalog`
- `bun test --test-name-pattern="^documented v2 consumer upgrade produces the fixed topic catalog$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- v2 consumer 必须通过显式迁移切换到固定 topic 根目录，运行时不读取遗留配置、不双读旧源或扫描测试。
Proves:
- 旧目录不符合固定契约时检查失败；显式切换并删除遗留配置后，topics、sync、check、按 topic list 与 show 均成功，随后修改旧源或新增未登记测试不改变结果。
