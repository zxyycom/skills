### Case GATE-FILE-SELECTION-001: 原生 Check 排除历史内容和未建立候选

Tests:
- `test:3f274048c2b86b61fb37e8881126b8b2964fe42c612859aca578352054781803`

Tags:
- `repository-tooling`

Contract:
- 当前门禁只检查可维护输入；函数指标按产品、自动化和测试责任分区，Markdown 解析事实写入受信绝对缓存目录，原生 Check 按任务性质声明仓库扫描或外部进程资源。

Proves:
- 每项原生 Check 的文件选择都包含 `docs/investigations/_resources/**` 排除规则。
- 文档扫描的 `json-validation` 与 blocking `markdown-link-validation` 排除根目录 `docs/investigations/_candidate.*`，因此未就绪 candidate 的资源链接不会伪装为正式维护文档损坏。
- `secret-detection` 使用门禁 owner 声明的完整文本输入范围，不回退到隐式全仓库扫描。
- function metrics 的产品区使用最严格阈值，自动化区适度放宽，测试区最宽松；三者的文件选择仍覆盖全部维护代码且包含历史内容排除。
- Markdown parse-facts cache 已启用且目录为绝对路径；七项原生 Check 的资源 claims 与其扫描或 SCC 进程性质一致。
