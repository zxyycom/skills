### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态

Tests:
- `test:2ccce67b2ba90aa503d2cb17b2b1cec1c21af41148393232922fb4244c318f1d`
- `test:ae2873a7692a5f881da181a853b23aea559f0c6d3e18073cc14897f1b5e9fc1c`

Tags:
- `decision-records`

Contract:
- 常规查询必须稳定读取当前持久快照，严格检查必须识别 ID-keyed state、独立 sourcePath、结构化 revision、已建立 alignment 与标签投影漂移；合法当前 Markdown 只能通过无选择的全量同步重建 definition 11 索引。

Proves:
- 真实索引文件的旧 definition 使 check 指引全量重建，同步后恢复 definition 11；sourcePath 与来源不一致及标签投影漂移被严格验证拒绝。
- 纯 parser 对非法顶层字段、旧 schema、非秒级或畸形 createdAt、非法 source fingerprint、标题/目的长度及 active/archived 的 null 或缺失 alignment 返回对应诊断，不获取文件。
- 真实非法 established 来源使 check 与 sync-index 均失败，报告 source/field 与可信历史恢复步骤，Markdown 与持久索引保持不变；合法 Markdown 漂移后全量同步采用规范来源并再次检查通过。
