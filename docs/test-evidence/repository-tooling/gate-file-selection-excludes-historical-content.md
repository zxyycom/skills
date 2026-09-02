### Case GATE-FILE-SELECTION-001: 原生 Check 排除历史内容和未建立候选

Entry:
- `scripts/vibe-check.test.ts > native file selections exclude historical content and authoring candidates`
- `bun test --test-name-pattern="^native file selections exclude historical content and authoring candidates$" ./scripts/vibe-check.test.ts`

Contract:
- 当前门禁只检查可维护输入；归档 Change 与 Investigation Report 的形成时资源必须同时被六项 Vibe 原生 Check 排除，未建立 candidate 不进入通用文档 gate。

Proves:
- 每项原生 Check 的文件选择都包含 `changes/archive/**` 与 `docs/investigations/_resources/**` 排除规则。
- 文档扫描的 `json-validation` 与 blocking `markdown-link-validation` 排除根目录 `docs/investigations/_candidate.*`，因此未就绪 candidate 的资源链接不会伪装为正式维护文档损坏。
