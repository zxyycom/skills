### Case GATE-FILE-SELECTION-001: 原生 Check 排除历史内容和未建立候选

Tests:
- `test:72f6abee64f1e7d0e87eb26a6dd7aa3529e065888d3e1794f4714228d1849a97`

Tags:
- `repository-tooling`

Contract:
- 当前门禁只检查可维护输入；已删除的 Change 不再有工作树 archive 例外，Investigation Report 的形成时资源与未建立 candidate 不进入通用文档 gate。

Proves:
- 每项原生 Check 的文件选择都包含 `docs/investigations/_resources/**` 排除规则。
- 文档扫描的 `json-validation` 与 blocking `markdown-link-validation` 排除根目录 `docs/investigations/_candidate.*`，因此未就绪 candidate 的资源链接不会伪装为正式维护文档损坏。
