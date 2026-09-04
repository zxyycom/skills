# Tasks

任务先固定纯 ID 的长期边界和迁移清单，再按领域完成实现与数据 cutover，最后以契约、测试和全仓库检查证明没有把路径继续当作 ID。

## Readiness

- [ ] 0.1 审计 Change Plan、Decision Records、Investigation Report、Test Evidence 与 Task Graph 中所有命名为 ID、selector、path、locator 或 reference 的字段和命令，形成可核对的迁移清单并确认没有按字符串外形误分类。
- [ ] 0.2 建立仓库级 ID/path 分离的长期 Decision，并以 successor Decision 演进当前含 `.md` 的稳定 Decision ID 判断；确认受影响 active Change 已声明本 Plan 的前置关系。
- [ ] 0.3 为 Decision/Investigation 当前 Markdown、关系和索引执行只读迁移预检，证明 `.md` 移除是一对一映射且最终关系图、资源 owner 和索引键无冲突。

## Implementation

- [ ] 1.1 在各领域 owner 中定义纯 ID grammar、ID 到受管路径的 resolver、明确的 ID/path 类型边界和确定性的 legacy selector 兼容层，不建立跨领域 registry 或按目标存在性猜测的 parser。
- [ ] 1.2 更新 Decision Records 的源码、关系事务、查询/生命周期/stage、索引定义、诊断和固定契约，并迁移当前受管关系与索引为 extensionless Decision ID。
- [ ] 1.3 更新 Investigation Report 的源码、candidate/formal/资源 resolver、关系/publish/discard/stage、索引定义、诊断和固定契约，并迁移当前受管关系与索引为 extensionless Investigation ID。
- [ ] 1.4 更新 Change Plan 的源码和固定契约，以 `changeId`、显式 `changeRoot` 与 status 完成单项选择，在结构化结果中分离 `changeId` 和 `changeDirectory`。
- [ ] 1.5 更新仓库模型、相关长期 owner、两个依赖 Draft、仓库内调用点、skill 版本、build 适配、生成 CLI、声明和 Schema，使新写入与输出只使用纯 ID。
- [ ] 1.6 审核 Test Evidence Case ID、Task ID 及 path/locator/reference 字段，保持已经正确的身份不变，并移除测试或文档中把存储路径误称为 ID 的断言。

## Verification

- [ ] 2.1 为每个受影响 ID parser/resolver 增加或更新最小原生测试，覆盖纯 ID、非法新 ID、legacy selector 规范化、custom root、active/archive 映射、candidate/formal 映射和 locale 无关排序。
- [ ] 2.2 用迁移 fixture 验证 Decision/Investigation 的新增、查询、关系、生命周期、publish/discard、资源 owner、索引 sync 与 stage 全程只输出纯 ID，并验证失败不留下混合格式或部分迁移。
- [ ] 2.3 验证 Change Plan 的六个命令在默认根、自定义根和 archived 查询中按 `changeId` 工作，目录安全、Plan 基线、archive no-overwrite 与结构化结果保持成立。
- [ ] 2.4 逐项维护受影响的 Test Evidence case 和统一派生索引，运行领域测试、生成边界检查与 `bun run check`，并审计受管当前内容中不存在仍作为 ID 保存的 `.md` 或目录前缀值。
