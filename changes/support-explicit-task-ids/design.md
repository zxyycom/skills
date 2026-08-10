# Design

本 design 为显式 task ID 建立一份 CLI 便携、持久索引安全且与自动编号共存的实施契约。

## Context

### 当前行为

- 当前 `schemaVersion: 2` 索引使用根级 `tasks[taskId]` 字典承接唯一身份，task entry 不重复保存 ID；所有 task ID、关系字典和 staging 选择都只接受规范自动 ID。
- `isCanonicalTaskId` 与 `taskReferenceSchema` 负责当前 ID 和 apply alias 校验；`validateTaskIndexSemantics` 把全部 ID 的数字后缀用于 `nextTaskId` 水位判断；staging 另外直接调用规范自动 ID validator。
- create operation 当前没有请求 ID，engine 总是从 `nextTaskId` 格式化自动 ID 并推进水位；CLI 已返回实际 `taskId`，apply 已按顺序返回 `createdTaskIds` 并把 alias 绑定到创建结果。
- CLI parser 把前导连字符解释为选项且没有通用结束选项语义；`@` 是 apply alias 前缀，关系命令中的 `null` 是清除 parent 的哨兵。默认 task-list renderer 使用方括号、逗号和 `@` 组织稳定文本 token。
- Task ID 同时是普通 JavaScript 对象键。纯数字键使用整数索引枚举顺序，不能可靠服从当前字符串字典的 canonical 排序路径。

### 实施基线与协调门禁

- task-000003 的语义依赖 task-000005 与 task-000010 已成功，不再阻塞本 Change。
- 实施以 task-000040 集成后的主线为基线；该任务只可能改变 task-graph 说明、长期决策和 skill 版本，不改变本 Change 的 ID 语义。
- task-000037 与本 Change 重叠修改类型、Schema、engine、CLI、生成产物和测试。两项工作必须串行；任一任务已经进入实施时，另一项等待其集成并重新核对基线。

## Goals / Non-Goals

目标：

- 让显式 ID 成为稳定、可复制且能在常见 shell 中直接作为一个裸 token 使用的操作句柄。
- 让显式选择、自动回退、批量 alias 和 `nextTaskId` 各自只有一个清楚的职责边界。
- 保持现有索引、自动 ID、关系、投影和事务安全不变量成立，并让所有入口共享同一 validator。
- 通过公开类型、CLI help、JSON Schema、生成产物、行为说明和测试证据交付完整能力。

非目标：

- 不判断 ID 文本是否在业务上“足够有意义”；字符合法性与调用方命名质量保持分离。
- 不增加 ID rename、旧索引迁移、自动 slug、大小写折叠、Unicode normalization 或冲突后缀策略。
- 不为已删除显式 ID 增加 tombstone、保留集合或默认历史；task 删除后的字符串复用不恢复旧 task 身份。
- 不改变 alias、parent sentinel、renderer token、task graph 拓扑、生命周期或 Git pending 的职责。
- 不为兼容任意字符串而扩展 shell parser、renderer escaping 或第二套 ID 表示。

## Decisions

### Decision 1: 区分自动 ID、显式 ID 和持久 task ID

- 自动 ID 继续使用小写 `task-` 加正十进制安全整数的规范形式：至少六位、左侧补零，超过六位自然扩展；`task-000000`、非规范补零和超出安全整数的值非法。
- 显式 ID 必须匹配以下基础规则：

  ```regex
  ^(?!-)(?![0-9]+$)(?=.{1,80}$)(?=.*[A-Za-z0-9])[A-Za-z0-9._-]+$
  ```

- 显式 ID 另外拒绝精确值 `null`、`__proto__`、`constructor`、`prototype`，并拒绝大小写不敏感的 `^task-[0-9]+$` 完整自动命名空间。
- 持久 task ID 是规范自动 ID 与合法显式 ID 的联合。实现分别提供自动、显式和联合判断，避免继续用 `isCanonicalTaskId` 同时表达三种含义。
- apply reference 是持久 task ID 或既有 `@<alias>`。显式 ID 字符集不包含 `@`，因此 reference 解析不增加优先级或逃逸规则。
- ID 原样保存、区分大小写且不归一化；`Foo` 与 `foo` 是不同身份。文档可以推荐小写，但 validator 不引入风格规则。

### Decision 2: 使用正向便携字符集而非标点黑名单

- ASCII 字母、数字、点、下划线和非前导连字符能够直接通过当前 CLI 的位置参数和 option value 路径，并避开 POSIX shell、PowerShell 与 cmd.exe 的常见展开和控制字符。
- `/`、`\\`、空白、引号、`@`、`=`、`:`、`,`、方括号、通配符、变量展开、重定向和管道字符全部因不在白名单而拒绝；无需为每个 shell 或 renderer 维护不断增长的例外列表。
- 纯数字 ID 除缺少稳定语义外，还会触发 JavaScript 整数索引枚举规则，因此明确拒绝。其他以数字开头但包含允许的非数字内容的 ID 合法，例如 `2fa-login`。
- 不限制尾部或连续分隔符；这些形式不产生 CLI 或索引歧义，命名质量由调用方负责。

### Decision 3: 只有占用冲突触发自动回退

- create request 使用可选 `taskId`。Schema 先完整验证请求；非法或保留的显式 ID 返回稳定 `REQUEST_INVALID`，不得被当作“无法采用”而静默回退。
- 未提供 `taskId` 时直接进入自动分配。提供合法且未占用的显式 ID 时原样创建，`nextTaskId` 不变。
- 合法显式 ID 已存在时，不覆盖、不修改既有 task、不追加后缀，改为分配规范自动 ID。批次按 operation 顺序观察当前事务工作副本，因此同批重复显式 ID 由第一项获得，后续项分别回退。
- 显式 ID 的占用只查询当前 `tasks` 字典。task 通过既有结果交付与关系闭合门禁被 remove 后，该字符串重新可用；后续创建的是独立新 task，不继承已删除 entry 的内容、关系、状态或结果，工具也不保留 retired-ID tombstone。
- 自动 allocator 从 `nextTaskId` 开始，防御性跳过任何已经占用的规范自动 ID；成功创建后把水位推进到下一候选，已分配自动编号始终不复用。整个 apply 仍在 clone 上完成，任一后续操作失败时 task、revision、alias 与水位一起回滚。
- `nextTaskId` 只描述自动分配空间。索引语义要求它大于全部已持久化规范自动 ID 的数值后缀；显式 ID 不参与最大数字推导。

### Decision 4: 所有结果和 alias 只表达最终实际 ID

- `task create --id <id>` 和 `task create --id=<id>` 进入同一 create operation；省略 `--id` 保持当前自动创建行为。
- 单次 CLI 成功结果继续返回 `{ taskId }`，其中只放实际创建的 ID。调用方需要判断是否回退时比较请求值与返回值，不增加平行身份字段。
- apply 的 `createdTaskIds` 保持 operation 顺序，alias map 的 value 使用对应实际 ID；同事务内 parent、dependency 和 exclusion 对 `@alias` 的解析不观察未采用的请求 ID。
- 已持久化后，show、update、relation、claim、renew、release、complete、fail、retry、cancel、remove 和 stage 都只接收联合 task ID，不区分其创建来源。

### Decision 5: 保持 Schema v2 并提升公开 CLI 次版本

- 本 Change 不改变索引字段、联合状态或关系结构；显式 ID 只按当前字典判重，无需保存 tombstone 或历史。新实现能够读取全部既有 v2 索引，只扩大 task ID 字符串的合法集合。因此保持 `schemaVersion: 2`，不制造全量索引改写或长期迁移能力。
- 一旦索引实际保存显式 ID，旧 runtime 会按旧的收窄 validator 拒绝它；调用方必须使用包含本能力的当前 runtime。行为 owner 和发布说明明确这一前向兼容边界。
- create operation、CLI option、公共类型和 JSON Schema 都发生可观察扩展，因此把当前 task-graph CLI 协议从 `3.1.0` 提升到 `3.2.0`。Skill 独立版本从实施时的当前值递增，不预先覆盖 task-000040 的版本变化。

### Decision 6: 复用现有 owner，不引入 renderer 或兼容层

- `schema.ts` 承接 ID 字符串事实源与 JSON Schema 派生信息；types、engine、CLI 和 staging 消费导出的领域判断，不各自复制正则。
- canonical serializer 继续按 task ID 字符串排序；显式 ID 排除纯数字键后，不需要替换对象表示或手写 JSON serializer。
- 默认 renderer 可以原样显示 ID，因为白名单排除了现有 token 分隔符和换行；本 Change 不增加 escaping 或显示别名。
- `tools/task-graph/` 是源码 owner；分发 MJS、source map、SDK 声明与 task index JSON Schema 只由现有同步入口生成，不直接编辑。

### Decision 7: 通过后继决策修订 ID 不复用规则

- 既有已对齐决策把“不复用”写成全部 task ID 的规则；本设计将其收窄为自动 ID 不复用、显式 ID 仅在当前索引唯一。
- 实施时新增一份自包含的后继决策，以 `修订` 关系指向实施基线中的直接前序。后继继续承接权威 JSON 索引、受控删除和无默认历史方向，并明确新的 ID 生命周期。
- 不直接改写既有已建立决策正文。实现与稳定行为 owner 全部对齐后，再把后继建立为当前基线并同步决策索引。

## Risks / Trade-offs

- 大小写敏感允许视觉相近的两个 ID；自动折叠会改写调用方身份且引入迁移语义，因此选择原样身份，并通过文档推荐小写降低误用。
- 保持 Schema v2 避免破坏全部既有索引，但旧 runtime 无法读取已经使用新显式 ID 的 v2 实例；生成产物、版本和发布说明必须同步，不能只提交源码。
- 联合 ID validator 会影响任务字典、关系字典、apply reference 和 staging；任何遗漏都会形成“能创建但不能完成后续生命周期”的半能力，验证必须覆盖完整 CLI 流程。
- task-000040 和 task-000037 会改变实施基线或相同文件；实施者必须满足 Context 中的基线与串行门禁，不能把它们的独立目标并入本 Change。
- 占用时自动回退符合既定目标，但脚本若忽略返回值可能继续使用请求 ID；CLI 和行为 owner 必须强调始终消费实际返回 ID。

## Open Questions

无。字符集、保留空间、分配回退、返回结果、ID 生命周期和版本策略已经收敛；实施只需满足 Context 中的基线与串行门禁。
