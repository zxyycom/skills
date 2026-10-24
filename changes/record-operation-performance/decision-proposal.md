# 决策候选正文草稿

此文件只供根审阅；quiet window 后通过公开 `new` 创建真实 candidate，再将正文写入该 candidate。它不表示已建立或已对齐。

拟用 name：`bound-selected-record-sync-currentness`；拟用标题：限定记录选择性同步的来源新鲜度；tags：decision-records、investigation-report、responsibility-boundaries；无演进关系。

## 目的

- 让小批正式记录同步只承担实际选中来源和必要依赖的当前性保证，同时保留完整发布索引的结构与关系合法性。
- 让调用者区分“局部当前来源已接纳”与“当前全集来源健康”，不从完整索引发布推断所有正文已重新检查。

## 背景

- 本判断只适用于本仓库的 `skills/decision-records/` 与 `skills/investigation-report/` 的 `sync-index --select`，不改变通用 Index Runtime 的 selected 协议、其他消费者或领域 stage。
- 合法发布索引已经保存定位、投影和来源 revision；若 selected 仍为验证未选变化而读取全部正文，少数对象操作会重复承担与全部存量相关的文件处理成本。
- 用户接受未读正文中的无关问题留给显式全集审计，但要求必要依赖、完整组合图、来源安全和实际写入保护继续成立。这是来源新鲜度范围的产品调整，不是保证全部相同的性能替换。
- 只读取已发布定位就不能同时发现未知新位置、未知重复身份或未知新引用；也不能从旧位置缺失区分实际删除和移动。

## 决策

- 采用: 将 `sync-index --select` 定义为严格合法 canonical 发布基线上的局部来源更新；缺失、损坏、不兼容的索引必须显式全量同步恢复，不当空基线或隐式降级。
- 采用: name 以 baseline 解析，实际只读取所选已知 sourcePath、前后直接关系邻居、完整受影响演进事件和必要资源 owner。未选必要依赖仍须符合发布投影与来源 revision；变化时补选或全量同步，不默默接纳。
- 采用: 已知路径缺失按所选删除处理，并继续验证完整组合图；这不声称识别了未知移动。已知路径内更正 ID 必须显式同选旧、新 ID，并以本次读取的 locator 证明新身份在合法发布投影及本次已读来源范围内唯一；未知新 ID 无已读位置依据时要求全量同步，不猜 basename。
- 采用: IR 删除或已读同路径改 ID 时，旧 owner 是已知受影响位置，准备与独立 fresh 均检查其路径缺失；任何残留（含空树、不安全类型及大小写异常）拒绝索引更新，不代删资源。应恢复报告或显式治理资源后全量同步，full sync 不会自动清除孤立树；不为此扫描其他 owner。
- 采用: 未读条目和来源 revision 沿用合法发布事实，索引仍完整发布并验结构、字段、身份唯一性、生命周期、关系与 owner 声明；不声称它们的正文当前。未知位置的新增、移动、重复身份和未同步新引用由 full sync/check 发现。
- 采用: 保留原生 baseline、集合 metadata/revision 和所选接纳保护；写前独立重读本次现存来源、必要依赖与实际索引，比较 bytes、identity、mode 和父链；缺失位置两次独立证明 canonical namespace 内安全缺失，不承诺缺失实体的 inode/mode 或缺失父目录跨阶段同一性，写后 readback 不省略。不为加速搬动写入、提交点、恢复或权限责任。
- 采用: selected 结果显式给出复合来源、局部 currentness 与 checkedIds；其中所选身份标签可表示缺失或同路径改 ID 的旧身份，不等于当前存在性保证，也不表示未知位置发现完整。
- 不采用: 新增 fast/unsafe 配置矩阵、隐式全源 header 扫描、跨调用缓存、持久 daemon 或数据库来模糊保证范围。需要当前全集健康或恢复未知布局时显式全量执行。
