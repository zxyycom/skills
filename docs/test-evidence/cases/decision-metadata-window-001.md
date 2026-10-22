### Case DECISION-METADATA-WINDOW-001: 元数据搜索限制返回窗口并保留全量精确匹配

Tests:
- `test:53ecb194fcac075da4b69fe3b90995a149d5dadbf7808dd34350d5db4b230724`
- `test:7101133e78e6607537281920b215c10aa3ed71d31279a06b689dc1adbdf3aacc`
- `test:88e7e0c971985c3387b3e2a7042621046b48fba64e1238d5d9548ec1df929752`
- `test:ae21650f5a9238e78ae94bac0b5036ec4829105f882045354ed75ad303c79c5e`
- `test:bc6b738e89eaa8e6b5e5b9a0baa75d5cb845f4325f75ace5ee807c03db8a8206`
- `test:c0a474a591b9a45c247246b4d6958379b89d7535087bac35a01d7ddf8e14c4db`

Tags:
- `decision-records`

Contract:
- Decision metadata 搜索默认返回最多 100 条，显式 limit 接受 1–1000 的正整数；窗口只限制完整命中结果及其字段证据的投影与留存，不停止后续匹配。
- metadata 对全部结构筛选候选匹配，保留既有 sourcePath 排序、筛选交集、关系筛选边与独立文本证据；matched 始终精确且 scanComplete 为 true，仅实际省略命中时 resultsComplete 为 false 并报告一次 max-records warning。
- 参数形状错误以 CLI 退出 2 和 stderr 诊断拒绝；content 的显式 limit 被拒绝，其固定 20 条预算不变。后续 matcher 失败优先于部分成功结果。

Proves:
- 0、100、103 个命中的内存投影分别返回 0、100、100 条，精确计数全部命中；覆盖、预算与 warning 只在实际溢出时报告结果限制。
- 自定义交集窗口保留全量精确计数与返回记录的字段证据；真实源码 CLI 的默认窗口、显式 3 与 1000 均正确接线并只渲染返回记录，超限 warning 只输出一行。
- 反序候选经标签与关系交集后保持 sourcePath 顺序、解析后的完整 anchor ID 和完整 filterRelations；title 与 relation summary 查询分别给出独立 matchedFields 与 matchedRelations。
- 已出现窗口外命中后，最后记录注入的真实 matcher aborted 仍产生 metadata-search-failed，而非带 searchInfo 的截断成功。
- CLI 拒绝非法数值、重复 limit 及 content limit，stdout 为空且退出 2；查询 API 在缺失集合处仍优先返回明确参数失败，help 公开默认值、上限和 content 限制。
