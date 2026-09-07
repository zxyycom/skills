### Case DECISION-INDEX-MAINTENANCE-001: 索引维护识别漂移并同步规范状态

Tests:
- `test:8010500e6348693d7e1b942fffc520166fd9a8bdd266a54009aa5696cbc28584`

Tags:
- `decision-records`

Contract:
- 常规查询必须稳定读取当前持久快照，严格检查必须识别 ID-keyed state、独立 sourcePath、结构化 revision 与标签投影漂移，同步必须从规范 Markdown 重建状态。

Proves:
- 旧 definition、非法 entry fingerprint、state/sourcePath 与 Markdown 声明不一致及标签字段篡改均被严格验证拒绝。
- Markdown 结构、关系或投影漂移时 list 与 trace 继续返回旧快照；写入同步后 schema v4 state-only 索引采用规范来源并再次检查通过。
