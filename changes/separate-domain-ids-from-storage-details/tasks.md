# Tasks

任务先固定显式 ID/name/path 的长期边界和迁移清单，再按领域解除 basename 身份依赖，最后以数据 cutover、路径回读和全仓库检查证明索引可从 Markdown 重建。

## Readiness

- [ ] 0.1 审计 Decision Records、Investigation Report、Test Evidence 与 Task Graph 中所有 ID、name、selector、path、locator 和 reference 字段，形成迁移清单；确认短期 Change Plan 不被纳入长期记录身份。
- [ ] 0.2 建立仓库级 ID/name/path 分离的长期 Decision，并以 successor Decision 演进当前 basename Decision ID 判断；确认三个记录领域下游 Change 已依赖显式 ID/sourcePath 基线。
- [ ] 0.3 对当前 Decision/Investigation Markdown、关系和索引执行只读迁移预检，证明现有 basename 到 extensionless ID 一对一，新增 frontmatter ID 后没有重复、悬空关系或 sourcePath 冲突。

## Implementation

- [ ] 1.1 在两个领域的 Markdown 契约、类型和 parser 中增加必填纯 `id`，让 scanner 同时产出独立 sourcePath，并为迁移 reader 固定短期兼容边界。
- [ ] 1.2 更新 Decision Records 的 source scan、candidate/active/archive resolver、关系、query/lifecycle/stage、索引 identity 校验和诊断，移除从 ID 计算 sourcePath 的身份不变量。
- [ ] 1.3 更新 Investigation Report 的 candidate/formal scan、关系、publish/discard/stage、资源 owner、索引 identity 校验和诊断，移除从 ID 计算报告路径的身份不变量。
- [ ] 1.4 迁移当前受管 Markdown 的显式 ID、extensionless 关系与派生索引，不移动现有文件；失败不得留下缺失 ID、混合关系或不可重建索引。
- [ ] 1.5 更新仓库模型、长期 owner、三个记录下游 Change、仓库内调用点、skill 版本、build 适配、生成 CLI、声明与 Schema，并保持 Change Plan 非目标一致。
- [ ] 1.6 审核 Test Evidence Case ID、Task ID 及 path/locator/reference 字段，保持已经正确的身份不变，移除把文件路径或 basename 误称为 ID 的断言。

## Verification

- [ ] 2.1 为两个领域增加或更新最小原生测试，覆盖显式 ID、缺失/重复/非法 ID、sourcePath 不等于 ID、重复路径、candidate/formal 和 active/archive 位置、`.md` 兼容输入及越界路径。
- [ ] 2.2 用迁移 fixture 验证新增、查询、关系、生命周期、publish/discard、资源、索引 sync 与 stage 全程输出纯 ID，并验证 ID 不变的文件移动只更新 sourcePath。
- [ ] 2.3 证明删除派生索引后可以分别从 name basename 与 ID basename 的 Markdown 重建完全相同的 ID-keyed 投影，索引回读会拒绝 source 内容 ID 不匹配和陈旧路径。
- [ ] 2.4 逐项维护受影响的 Test Evidence case 和统一派生索引，运行领域测试、生成边界检查与 `bun run check`，并审计受管当前内容不存在仍作为 ID 保存的 `.md` 值。
