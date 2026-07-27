### Case TEST-EVIDENCE-PATH-IDENTITY-001: 配置、Catalog 与索引路径身份拒绝冲突
Entry:
- `tools/test-evidence/tests/run.ts > catalog paths reject aliases, hard links, and platform-equivalent identities`
- `bun test --test-name-pattern="^catalog paths reject aliases, hard links, and platform-equivalent identities$" ./tools/test-evidence/tests/run.ts`
Contract:
- 配置文件、catalog 根目录与索引目标必须按解析后路径、平台身份和文件身份保持互异。
Proves:
- 点段或重复分隔符别名、大小写等价身份和同 inode 硬链接都产生阻断路径冲突。
