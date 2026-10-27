# 待提交快照操作契约

## 模型与使用顺序

`stage` 将所选对象的当前版本合成到 Git 待提交快照，保留未选 pending；它不提交或推送。三方事实分别是固定的 HEAD（H）、工作区（W）和已有 pending（P）。身份与旧路径必须有可信定位，scope 决定本次更新和验收哪些内容，而不是扩大选择范围。执行时先确定完整 ID 和 scope，检查基线及来源，再依据结果核对实际写入与保留范围；冲突或无法证明定位时停止并恢复，不靠重试猜测状态。

先读[快照的领域边界](investigation-report-contract.md#待提交快照)。`stage <selector...> --scope ...` 显式选择即用当前完整版本刷新所选对象，未选 pending 保持；已有部分暂存会被该对象在指定 scope 内的完整版本取代。

## 选择与定位

从 HEAD、工作区和 pending 的发布投影及必要 pending 身份解析 ID／name；候选不参与。sourcePath 改变选同一 ID，删除选旧 ID，rename 同选旧、新 ID。旧位置由可信 H/W/P 索引或所选 canonical locator 定位；不会扫描全部 pending 正文恢复身份。索引不能定位的旧非 canonical pending 来源须先恢复可信定位，不保证仅换 scope 即可找回。

## Scope 与调用方责任

| scope | 写入与验证范围 |
| --- | --- |
| `all`（默认） | 原子刷新所选发布投影、正式 Markdown 与完整 owner 树，未选条目沿用 pending；验证所选来源、直接资源、索引 owner 声明及合成图。 |
| `index` | 只刷新所选发布投影及来源 revision；payload 验收限于本次消费或修改的索引文件，不读取工作区正文。调用方负责配套领域暂存与正文验证。 |
| `domain` | 只刷新所选正式 Markdown 与完整 owner 树，保持 pending 索引原字节或缺失状态。来源验证同 all，但不证明索引已配套。 |

## 基线与所选来源

domain 的身份解析与旧位置收集分别进行：

- 合法可用的 P 索引补充**所有所选 ID** 的旧 sourcePath，即使 H/W 已有该 ID；所选 canonical pending 路径始终采集并核对。
- 仅 P 索引自身读取或解析失败可容错，且须由独立 H/W/canonical locator 足够定位所选；否则先恢复可信定位。该例外不覆盖已定位所选正文的读取、身份或路径失败。
- 成功读取的 P 索引原始字节纳入独立写前复核；使用其定位后扩大内容选集也须证明扩展有效。P 索引的原字节、mode/OID 或缺失状态保持，不因定位消费而改写。

HEAD 与工作区发布索引须通过字段、关系与资源 owner 声明验证；index／all 还验证 pending 索引，并要求存在的三方索引具有相同集合 metadata、sourceRevision.metadata 与 definition。HEAD 正式 namespace 真正为空且 pending 无索引时从空基底组合；已有历史正式成员却缺索引时明确恢复。已有 HEAD 索引却将 pending 索引删除时，index／all 提示先恢复该删除。损坏或不兼容走显式恢复。

`all`／`domain` 的所选现存来源须符合工作区发布投影，合法手改先同步。owner 树取 HEAD、pending 与工作区的所选 owner 路径并集，包含未引用成员与待删除旧成员。引用资源须存在，全部相关路径分量须安全；空资源树仍检查根和 owner，文件表示尊重 Git `core.fileMode`。

其他 owner 的正式声明只参与索引验证，所选来源的直接资源按所需字节验证；不额外读取或暂存依赖报告正文。stage 不重建全部 HEAD 正文或重新发现全部未同步工作区身份；完整索引、图及 pending 保护仍有集合级成本。

## 独立验证与 pending 保护

操作核对 scope 所需来源、成员、工作区索引、HEAD 与完整受管 pending 身份；写前独立重新核对可变事实，写后验收实际目标并保护范围外状态。HEAD、pending 或其他受保护事实发生冲突时停止。只验收本 scope 所需索引、所选来源和直接资源 payload；其余 pending 成员以完整路径、文件模式与对象 ID 保护身份，不读取无关 blob。所需读取失败或保护范围漂移时停止，未变化结果也须通过保护检查。

原子更新保留未选领域文件的字节、表示及 staged 删除。`index` 的非索引保证限于身份保持，正文及资源的内容验证由调用方配套完成；它不证明这些 payload 即时可读或指纹有效。可连续暂存不同对象，再重复选择以刷新某一对象。索引 JSON 可规范化序列化，未选条目含义保持。

结果说明写入路径、保留的 pending 和调用方责任；成功只证明所选 scope。
