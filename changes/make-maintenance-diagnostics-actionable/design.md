# Design

本 design 供共享层、领域事务和 CLI 的实施与审查 agent 使用：共享层只保留它能证明的错误事实，事务 owner 独立声明 mutation 结果，CLI 最后组合领域上下文和恢复动作。

## Context

- `VersionControlError` 当前只有少量 code，其中大多数 Git 读取错误成为 `operation-failed`；多处 `catch {}` 在构造该错误前已经丢失 stderr 或 Node cause。
- pending replacement 在创建 `.git/index.lock` 失败时只特判 `EEXIST`，其他失败不保留 cause；后续恢复路径也会把原始失败替换为宽泛结果。
- index-runtime 已有稳定 `StateIndexDiagnostic` code 和 staging state，但会把除 conflict/recovery 外的 pending 错误统一显示为“检查 repository access 后重试”，无法确认是否真是权限问题。
- Decision Records 使用字符串 `errors/warnings` 和 attention；Investigation Report 的结果部分结构化了 `changed`，但多数 operation error 仍是字符串。两套 mutation lock 对所有取锁异常都提示等待当前事务。
- 调查报告的 unrecorded predecessor warning 是非阻断信息；当前实现捕获任何 Git 异常后返回空集合。决策历史和调查 destructive discard 则依赖 Git 成员判断作安全门禁。
- 本 Plan 只完整拥有 Decision Records、Investigation Report 及其共享调用链的用户可见失败；其他消费者只因共享类型变化接受兼容迁移，不自动进入全量文案重写。

## Goals / Non-Goals

目标：

- 尽可能靠系统错误码和明确事务阶段分类，不靠脆弱的任意 stderr 猜测。
- 让每个最终用户诊断都能回答操作、对象、原因、写入结果和下一步。
- 让 shared、index-runtime 与领域层各只包装一次，并保留稳定机器字段。
- 对未知或恢复不完整状态保持诚实，不用“应该未修改”替代证据。

非目标：

- 不建立通用日志平台、遥测、远程错误上报、国际化框架或异常堆栈 UI。
- 不自动申请权限、调用 `sudo`、删除 `.git/index.lock`、修复仓库或重试写入。
- 不承诺从所有 Git stderr 精确识别平台策略；没有强信号时保留 `command-failed` 与受控 detail。
- 不因改善错误文案而改变领域授权、确认门禁、退出码或成功语义。
- 不顺手重写与 Decision Records、Investigation Report 及其共享调用链无关的全部仓库文案。

## Decisions

### Intended Change

#### 共享失败事实

错误信息沿单一方向传递，后层可以增加自己拥有的事实，但不能改写或猜测前层事实：

```text
系统/Git cause
  -> shared operation event + cause category + target/detail
  -> transaction owner adds mutation scope/outcome
  -> domain adds Decision/Investigation context and severity
  -> CLI renderer adds ordered recovery steps
```

共享版本控制错误采用稳定的事实字段，而不是只保存一段 message：

- `code`：失败的稳定 operation event，例如 discovery failure、revision read failure、pending conflict、pending replacement failure 或 pending recovery failure；它回答“什么操作事件失败”，不同时承担原因分类。
- `causeCategory`：小而稳定的原因集合，至少区分 `access-denied`、`busy`、`not-repository`、`tool-unavailable`、`revision-unavailable`、`repository-policy`、`command-failed` 与 `unknown`；它回答“当前证据支持什么原因”。
- `operation`：失败的受控动词短语，例如读取当前 revision、列出 HEAD 文件或替换 pending 范围。
- `target`：能够安全定位的仓库相对路径、范围或逻辑目标；没有可靠目标时为 null。
- `detail`：经 trim、单行化、长度限制和敏感模式处理的系统错误或 Git stderr；分类不依赖必须展示 detail。

共享 error 不携带整个命令的 mutation outcome，因为底层读取或 Git 调用不知道此前是否已经发生工作树写入。拥有提交点和恢复证据的事务结果另外增加：

- `scope`：outcome 覆盖的明确范围，例如 decision working-tree collection、investigation report/index transaction 或一个 Git pending path scope。
- `outcome`：`no-change`、`rolled-back`、`partial-or-unknown` 或 `committed-cleanup-pending`。

保留原始 `cause` 只服务进程内归因或测试，不直接递归输出。既有 error code 如有稳定消费者，通过显式映射或兼容别名迁移；不得用同一字段同时混合 operation event、cause 和 transaction outcome。

#### 分类优先级

分类只采用可靠证据：Node `EACCES/EPERM` 是 access denied，锁文件 exclusive create 的 `EEXIST` 是 busy，Git executable 启动 `ENOENT` 是 tool unavailable，明确的 worktree discovery 结果是 not repository。仓库策略只有在 Git 提供受控、可识别信号时单列；其他非零 Git 结果保留 command failed 和净化后的 stderr。

锁提示不能断言一定存在活动事务。busy recovery 先要求等待已知并发操作；若没有活动 Git/领域进程，再检查遗留锁。工具不自动删除锁。access denied recovery 只要求让当前任务/进程获得目标操作所需权限或在已授权环境执行原命令，不指定宿主的授权机制。没有强信号时使用 `unknown` 或 `command-failed`，不得从“可能需要权限”升级为 access denied。

#### 领域呈现

最终 CLI renderer 使用固定顺序输出稳定 code、操作与目标、原因、`scope + outcome` 和下一步。领域层可以补充 Decision ID、Investigation ID、关系类型或命令参数，但不得再次把共享 message 包进 `Failed to ... operation failed`。同一结果中的重复诊断按 code、cause category、target、state ID 和 operation 去重排序。

参数与内容错误继续使用领域 code，但完成同一信息审计：标识非法值、预期格式、所属字段/文件和可行修复。对纯语义不成立的关系或闭包，不伪装成系统异常，也不附加权限建议。

#### Git 历史与 mutation outcome

决策建立、归档及删除所需的 Git 历史检查保持 fail closed；读取失败返回 `no-change`，并明确恢复权限或仓库状态后重新执行原命令。调查关系的未记录前序仍只产生 warning，但 Git 基线不可用时必须产生独立 `history-check-unavailable` warning，不能将 unknown 映射成“全部已记录”或“没有前序”。调查 discard 等破坏性检查继续 fail closed。

pending 和工作树事务在状态转换点为自己的 scope 记录 outcome：写入前失败为 no change；写入后成功恢复为 rolled back；无法证明恢复完整为 partial or unknown；索引提交点之后只有临时清理失败为 committed cleanup pending。CLI 和公共结果使用该字段；底层 Git operation、相邻 scope 或 renderer 都不得外推更大的 mutation 结果。

### Resulting Impacts

#### API 与消费者

共享 `VersionControlError` 的构造、序列化辅助和全部抛出点需要更新；index-runtime、Decision Records、Investigation Report 以及仓库中其他直接按旧 code 分支的消费者必须完成编译期盘点。无关消费者只做保持现有行为所需的兼容映射，不进入本 Change 的用户文案成功标准。

Decision Records 和 Investigation Report 现有公开结果尽量保持业务字段稳定；需要让 operation event、cause category 或 scope/outcome 可被程序化消费时显式扩展结果和声明，不把机器信息只藏在 CLI 文本。生成器从维护源码同步分发边界。

#### 文档与决策

两套固定契约和恢复指南明确哪些 Git 检查阻断、哪些只 warning，以及四种 mutation outcome 的操作者义务。若共享诊断分类、scope/outcome 或静默错误边界构成长期跨工具契约，则在实现验证后建立独立 Decision；一次性措辞清理不写入决策记录。

#### 验证策略

权限和 Git 失败通过 fake repository、注入 hook 或受控 child-process adapter 产生，避免 root、Windows 或不同文件系统使 chmod 测试失真。测试主要断言 operation event、cause category、operation、target、scope/outcome 和 recovery，再对少量 CLI 集成断言人类文本包含必要段落；不锁死完整句子或系统原始 strerror。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 错误 taxonomy 过细并变成第二套平台模型 | 只保留会改变操作者动作或 mutation 判断的稳定类别，其他进入 command failed |
| 解析 Git stderr 跨版本不稳定 | 优先系统 error code 和明确命令状态；仅对受控强信号分类，其余保留净化 detail |
| detail 泄露 token、远端 URL 或本机敏感路径 | 单行、限长、敏感模式处理；优先仓库相对 target，不默认输出完整 command/env/stack |
| mutation outcome 脱离 scope 或被底层错误推断 | 事务 owner 同时设置 scope/outcome；shared error 与 renderer 都不根据 code 猜测 |
| 修改共享 error code 影响其他工具 | 先盘点直接消费者，提供显式映射并以 typecheck/定向测试门禁 |
| 全量文案审计扩大为无边界重写 | 只覆盖两套目标 CLI 的用户可见边界及共享调用链，按可操作信息缺口而非风格统一修改 |
| 中英文混用仍可能存在 | 本 Change 保持各 CLI 现有主语言，优先信息完整性；不引入独立国际化项目 |

## Open Questions

无。

## Plan Use Contract

- 目标消费者是修改共享版本控制、index-runtime 和两套领域 CLI 的实施与审查 agent；先建立错误清单和事务提交点清单，再修改类型。
- `code`、`causeCategory` 与 `scope/outcome` 是不同关系轴；任何实现若把三者重新压成一段 message，即未兑现本 Plan。
- 本 Plan 的“全部用户可见失败”只指两套目标 CLI 及其共享调用链；其他工具只承担共享 API 兼容，不得被顺手重写。
- Tasks checkbox 只记录执行证据，不代表错误分类或长期 Decision 已获语义确认。
