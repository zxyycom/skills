### Case TEST-EVIDENCE-QUERY-SHOW-001: Topic Catalog 支持精确列出、搜索与展示
Entry:
- `tools/test-evidence/tests/run.ts > catalog queries list, search, and show exact cases`
- `bun test --test-name-pattern="^catalog queries list, search, and show exact cases$" ./tools/test-evidence/tests/run.ts`
Contract:
- List、search 和 show 必须使用统一 case 身份、topic 路径与单 case 权威正文。
Proves:
- ID 顺序、`<topic>/<slug>.md` 源路径、契约词搜索、证明词搜索及 Markdown 展开均返回精确结果。
