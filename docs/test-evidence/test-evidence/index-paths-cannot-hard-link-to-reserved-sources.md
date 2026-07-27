### Case TEST-EVIDENCE-INDEX-HARDLINK-001: 索引路径不能硬链接到保留源
Entry:
- `tools/test-evidence/tests/run.ts > index paths cannot hard-link to reserved sources, config, or case files`
- `bun test --test-name-pattern="^index paths cannot hard-link to reserved sources, config, or case files$" ./tools/test-evidence/tests/run.ts`
Contract:
- 索引目标与配置、topic 表、README 和权威单 case 文件必须保持文件身份隔离。
Proves:
- 指向任一保留源或配置文件 inode 的硬链接都会阻断索引同步。
