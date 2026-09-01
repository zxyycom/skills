### Case TEST-EVIDENCE-INDEX-HARDLINK-001: 固定索引不能硬链接到权威源
Entry:
- `tools/test-evidence/tests/catalog.test.ts > fixed index cannot hard-link to authoritative sources`
- `bun test --test-name-pattern="^fixed index cannot hard-link to authoritative sources$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 固定索引目标与 topic 表和权威单 case 文件必须保持文件身份隔离。
Proves:
- 固定索引指向 topic 表或 case 文件 inode 的硬链接都会阻断同步。
