# 待提交快照操作契约

## 模型与使用顺序

`stage` 将所选对象的当前版本合成到 Git 待提交快照，保留未选 pending；它不提交或推送。三方事实分别是固定的 HEAD（H）、工作区（W）和已有 pending（P）。身份与旧路径必须有可信定位，scope 决定本次更新和验收哪些内容，而不是扩大选择范围。执行时先确定完整 ID 和 scope，检查基线及来源，再依据结果核对实际写入与保留范围；冲突或无法证明定位时停止并恢复，不靠重试猜测状态。

`stage <selector...> --scope ...` 只构造 Git pending，不改变生命周期或代替同步。显式选择即用当前完整版本刷新所选对象，未选 pending 保持；已有部分暂存会被该对象在指定 scope 内的完整版本取代。

## 选择与定位

从 HEAD、工作区和 pending 的发布投影与必要 pending 身份解析 ID／name；位置变化选同一 ID，删除选旧 ID，身份更正同选旧、新 ID。领域 scope 从索引可定位路径和所选 canonical basename 识别仅 pending 存在的来源，并清理可证明属于所选 ID 的旧位置；不扫描无关 pending blob 发现身份。任意 basename 的 pending-only 来源若已失去 H/W/P 索引定位，明确失败并保留 pending；恢复方式见[维护恢复](maintenance-recovery.md#历史与-pending-定位恢复)。

## Scope 与调用方责任

| scope | 写入与保留 |
| --- | --- |
| `all`（默认） | 原子组合所选发布投影与正式 Markdown；未选条目沿用 pending，而非 HEAD。 |
| `index` | 只刷新所选发布投影及来源 revision；payload 验收限于本次消费或修改的索引文件，不读取工作区正文。调用方负责配套领域暂存与正文验证。 |
| `domain` | 只刷新所选正式 Markdown，保留 pending 索引原字节（即使损坏）或缺失状态。 |

## 基线与所选来源

domain 的身份解析与旧位置收集分别进行：

- 合法可用的 P 索引补充**所有所选 ID** 的旧 sourcePath，即使 H/W 已有该 ID；所选 canonical pending 路径的 header 始终读取并核对。
- 仅 P 索引自身读取或解析失败可容错，且须由独立 H/W/canonical locator 足够定位所选；否则先恢复可信定位。该例外不覆盖已定位所选旧正文的读取、身份或路径失败。
- 成功读取的 P 索引原始字节纳入独立写前复核；使用其定位后扩大内容选集也须证明扩展有效。P 索引的原字节、mode/OID 或缺失状态保持，不因定位消费而改写。

HEAD 与工作区发布索引必须合法；index／all 还验证 pending 索引，并要求存在的三方索引具有相同集合 metadata、sourceRevision.metadata 与 definition。HEAD 正式集合确为空且 pending 无索引时从空发布基底组合；已有历史正式成员却缺索引时显式恢复。已有 HEAD 索引而 pending 将其删除时，index／all 提示先恢复该删除。坏基线不隐式重建全部 HEAD 正文。

`all`／`domain` 的所选现存正文须符合工作区发布投影；合法手改先同步。index／all 的最终合成图必须合法，必要依赖缺失时提示补选，不自动夹带未选对象。domain 只证明领域文件范围，不证明 pending 索引与正文已配套。stage 核对所选已知受管位置，未知位置的未同步身份重现由显式 check／sync 发现。

## 独立验证与 pending 保护

未变化条目的现有 Git index 标志保持；变化条目的标志按 Git 对目标的更新处理。

操作核对 scope 所需来源、成员、工作区索引、HEAD 与完整受管 pending 身份；写前独立重新核对可变事实，写后验收实际目标并保护范围外状态。HEAD、pending 或其他受保护事实发生冲突时停止。按 scope 验收 payload：`index` 只验收所需索引内容，其余 pending 成员以完整路径、文件模式与对象 ID 保护身份；`all`／`domain` 只读取本次所选正文及必要定位索引的 payload；关系依赖由索引验证，不读取未选依赖正文。所需读取失败或保护范围漂移时停止，未变化结果也须通过保护检查。

原子更新以完整 Git 路径、mode 和 OID 保留未选 pending（含 staged 删除）；所有 scope 对未选 payload 均只保证身份保持，不证明内容即时可读或指纹有效。`index` 的配套正文验证由调用方负责，`all`／`domain` 独立验收所选正文。可连续 stage A、stage B，再修改 A 并重选 A；B 始终保留原 pending。索引 JSON 可规范化序列化，未选条目含义保持。

结果报告实际写入路径、保留范围及调用方责任；成功只证明所选 scope。
