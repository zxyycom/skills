# Tasks

任务先确认显式 ID/sourcePath 基线和两个领域的日期事实，再实现共同可观察的 ID-first selector、name 索引、日期创建与 name/ID 路径分配，最后验证重名和 legacy 冲突不会产生猜测或不可选择状态。

## Readiness

- [x] 0.1 确认 `separate-domain-ids-from-storage-details` 已完成，Decision/Investigation Markdown、关系和索引均使用显式 extensionless ID，索引能够独立定位 sourcePath。
- [x] 0.2 审计两个领域所有普通单对象输入、新建入口、关系 mutation、lifecycle、query、trace、stage 和错误 envelope，形成接入 ID-first selector 的完整清单；明确维护型精确 ID 参数和 path 参数不误用普通 selector。
- [x] 0.3 固定 Decision candidate 形成日、Investigation `formedAt` UTC 日期、标准 ID/name grammar、legacy name 解释和 name/ID 两种 basename 的全生命周期冲突矩阵，并演进达到门槛的长期 Decision。

## Implementation

- [x] 1.1 在 Decision Records 与 Investigation Report 各自实现 calendar-valid `YYMMDD-<name>` parser 和一个大小写不敏感末尾 `.md` 的兼容规范化，保持相同可观察结果而不建立跨领域记录平台。
- [x] 1.2 扩展两个派生索引的 state/name key、Schema、规范排序、query 和诊断，使 ID 仍为唯一 entry key，name 可稳定返回零个、一个或多个 ID，sourcePath 只负责定位。
- [x] 1.3 将 Decision 的 new、query、关系、lifecycle、trace 和 stage 等普通输入接入 ID-first/name-fallback resolver，并让 candidate 创建日自动形成或验证标准 ID。
- [x] 1.4 将 Investigation 的 new、show、query、publish、discard、关系、trace 和 stage 等普通输入接入同一 resolver，并让 `formedAt` 自动形成或验证标准 ID。
- [x] 1.5 为两个领域实现“完整生命周期中的 name 路径可用则使用 name，否则使用完整 ID”的 sourcePath allocator，覆盖 candidate/formal、active/archive、publish 和 no-overwrite 回读。
- [x] 1.6 在 `new` 写入前识别同名 legacy 记录，零写入返回 `migration-required`、legacy ID、建议 dated ID 和 rename/preflight 默认指引；不隐式调用 rename，也不建立迁移加创建的一体化事务。
- [x] 1.7 更新两个 skill 行为入口、固定契约、CLI help、类型/Schema、结构化输出、版本、build 适配、生成产物和下游 selected-sync/rename Change 的依赖说明。

## Verification

- [x] 2.1 增加 parser/resolver 最小原生测试，覆盖标准 ID、无效日期前缀、唯一/重复/缺失 name、精确 ID 不回退、一个大小写不敏感 `.md`、其他后缀、路径输入和 locale 无关候选排序。
- [x] 2.2 分别验证两个领域 name 输入自动使用权威 UTC 日期、标准 ID 输入日期一致性、同日同名 ID 冲突、跨日同名 ambiguous，以及持久关系和结构化输出始终保存完整 ID。
- [x] 2.3 验证 name/ID 两种 basename 的创建、publish/lifecycle、路径占用回退、sourcePath 回读、并发漂移、no-overwrite 和失败零写入；文件名不得参与 ID/name parser。
- [x] 2.4 验证 unique legacy name 正常解析、冲突前 `new` 返回完整 migration-required 指引且不写入、rename 后重试可创建；逐项维护 Test Evidence case 与统一派生索引并运行领域检查和 `bun run check`。
