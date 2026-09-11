### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态

Tests:
- `test:2ccce67b2ba90aa503d2cb17b2b1cec1c21af41148393232922fb4244c318f1d`

Tags:
- `decision-records`

Contract:
- 常规查询必须稳定读取当前持久快照，严格检查必须识别 ID-keyed state、独立 sourcePath、结构化 revision、已建立 alignment 与标签投影漂移；合法当前 Markdown 只能通过无选择的全量同步重建 definition 11 索引。

Proves:
- 合法来源配合旧 definition 得到 check 的全量重建指引并重建为 definition 11；非法 entry fingerprint、active/archived 的 null 或缺失 alignment、state/sourcePath 与 Markdown 声明不一致及标签字段篡改均被严格验证拒绝。
- 非法 established 来源使 check 与 sync-index 均失败、报告 source/field 与可信历史恢复步骤，且 Markdown 与持久索引字节保持不变；合法 Markdown 漂移后全量同步采用规范来源并再次检查通过。
