# 记录领域的内部暂存协调

本文件定义 Index Runtime 对 Decision Records 与 Investigation Report 的内部暂存接点；通用接口与 scope 见 [Index Runtime](README.md)。

## 协调器契约

`src/record-staging.ts` 是 Decision Records 与 Investigation Report 的内部接点，不从公共 `src/index.ts` 导出，也不改变[通用按 ID staging](README.md#按-id-staging-到-pending) 使用的固定 revision 基底。`readRecordStagePending` 维护 scope 的 payload 策略，`stageRecordSelection` 维护共同投影与阶段顺序；领域普通查询与维护事务不接入此协调器。

阶段责任与范围保护的整体模型见[共同记录操作模型](../record-operations/model.md)。此协调器的具体不变量如下；H、W、P 分别指固定 HEAD、工作区和 Git pending。

- **scope**：所有 scope 保护完整 pending 路径、mode、OID 身份，使用 `content-paths` 验收所选 payload。index 只读目标索引；all/domain 只读领域所选来源、更新路径、资源与必要定位索引，删除也进入选择。
- **投影**：index/all 检查存在的 H/W/P 索引的 namespace、definitionVersion、集合 metadata 与 `sourceRevision.metadata`，以捕获的 pending 为基底刷新选中 state 和逐 ID revision，完整 build、校验和序列化。domain 不改写 pending 索引；为定位旧位置读取该索引的容错由领域契约规定。
- **阶段**：准备和写前 fresh 各自验收真实 W/P payload、完整身份及所需来源、表示和目录事实；先读索引再扩大选集时须证明完整身份与已读 payload 未变。写入锁内执行 HEAD/P CAS、写后验证和范围外保护；unchanged 也完成保护。固定 H 的合法投影和纯派生事实可调用内复用。
- **复用边界**：只有本阶段新鲜内容与完整身份、固定 definition/H 和选择证明等价，才可复用不可变解析和确定性目标；OID 相同或旧阶段通过不足以替代来源、表示及目录验收。差异和非法输入保持原验证与错误优先级，不跨调用缓存。
- **领域适配**：各域提供 definition、位置、选择、写集及来源证据；index 不读取正文或资源。Decision 拥有状态、alignment、位置和演进闭合，Investigation 拥有关系、正式来源、资源 owner 和路径安全。共同协调器不接管领域语义。

共同核心提供 snapshot 成员、实际变更路径与相对 H 的变化 metadata；各域将这些事实映射为既有诊断与结果 envelope。字段语义分别由 [Decision 适配](../decision-records/README.md#stage-的领域适配)和 [Investigation 适配](../investigation-report/README.md#stage-的目录与来源)承接，本接点不统一 DTO 或为显示补读正文。

任何 scope 的未选 payload 不可读但身份稳定不构成失败；所选 payload 失败、完整身份漂移或领域证据漂移仍拒绝发布。完整索引、图、pending 成员与物理事务复制仍有集合级成本。
