### Case TEST-EVIDENCE-INDEX-RESERVED-PATH-001: 索引路径不能覆盖保留源文件
Entry:
- `tools/test-evidence/tests/run.ts > index paths cannot overwrite reserved sources or case files`
- `bun test --test-name-pattern="^index paths cannot overwrite reserved sources or case files$" ./tools/test-evidence/tests/run.ts`
Contract:
- 索引写入目标必须与配置、topic 表、README 和权威单 case 文件保持路径隔离。
Proves:
- 把任一保留源或配置路径用作索引目标都会产生路径冲突且不会写入。
