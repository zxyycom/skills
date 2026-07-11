---
name: decision-records
description: 建立、编写、修订、审阅和验证一套可在不同项目复用的显式 Markdown 决策记录方案。用于初始化或维护 `docs/decisions/`、记录会影响后续工作的长期判断、更新 `amended`/`superseded`/`invalidated` 关系、从历史决策恢复上下文，或使用配套 CLI 检查结构、按状态列出决策和同步活动索引时。
---

# Decision Records

## 目标

在不同工作区使用同一套简单、公开、可版本化的决策记录方案。把决策写成普通 Markdown 文件，让人类和 agent 都能直接阅读、审核、修订和优化，并在未来任务中重新获得形成当前做法的上下文。

把 `docs/decisions/` 视为长期记忆的显式 owner。不要建立数据库、缓存、隐藏文件或另一份机器状态来承接决策内容。

## Owner 分工

1. 本文件承接判断与维护流程：何时记录、怎样新增、怎样修订以及何时读取历史。
2. [decision-record-rules.md](references/decision-record-rules.md) 承接固定目录、命名、状态、正文模板、索引和校验契约。
3. `scripts/decision-records.mjs` 承接结构检查、状态筛选和活动索引同步，不判断决策内容是否正确或值得记录。
4. 目标工作区的 `docs/decisions/` 承接实际决策；skill 包本身不保存用户的动态记忆。

## 主动引用

1. 初始化决策体系、创建或修订记录、处理状态关系时，完整读取 [decision-record-rules.md](references/decision-record-rules.md)。
2. 同时读取目标工作区的 `AGENTS.md`、项目说明、`decision-record-index.md` 和相关影响面记录。
3. 项目可以增加更严格的语义门槛和领域约束；保持固定结构契约不变。确需更换格式时，把它视为方案分叉并同步修改 skill、规则和校验器。
4. `references/archive/` 只保存体系演进参考，不进入正常执行路径。

## 执行流程

### 1. 定位决策体系

1. 优先使用用户明确指定的决策目录。
2. 未指定时使用当前工作区的 `docs/decisions/`。
3. 目录不存在且用户要求建立或记录决策时，按规则 reference 创建最小体系：规则 owner、索引 owner、当前需要的影响面目录和首条决策。
4. 用户只要求解释、检查或审阅时保持只读。

### 2. 判断是否值得记录

只记录已经确认且以后仍可能影响工作的判断。依次检查：

1. 没有这条记录时，未来是否难以解释为什么采用当前方案而不是其他合理方案？
2. 这项判断是否会改变后续行为、owner、边界、兼容性、风险处理或验收方式？
3. 它是否包含可复用的取舍，而不是普通事实、状态快照、任务或执行结果？

把用户明确选择、批准或要求长期沿用的方案视为已确认。把建议、推测、开放问题和临时做法留在讨论或任务 owner，不写成 `active` 决策。

### 3. 读取相关历史

1. 先从活动索引按稳定影响面定位当前决策，不按日期遍历全部文件。
2. 需要理解演进原因时，使用 CLI 的 `list --all` 或 `list --status` 定位非 `active` 记录，再沿状态来源链接读取。
3. 区分当前规范与决策历史：当前 owner 说明现在怎样做，决策记录解释为什么形成当前做法。
4. 当前指令改变旧判断时，把变化写成新决策并更新旧记录状态，不用旧记录阻止用户重新决定。

### 4. 写入或修订

1. 每个文件只承接一个需要回放的判断。
2. 将记录放入最稳定的影响面；影响面使用名词或名词短语，不使用一次性任务名。
3. 使用最小正文写状态、问题、决定、影响和验证；只有需要回放关键背景或收敛过程时才使用完整正文。
4. 明确写出采用什么、关键备选为什么不采用、以后何时沿用或重新评估。
5. 新判断改变旧判断时，在同一轮完成新记录、旧文件重命名、正文状态、状态来源链接和索引链接更新。
6. 将 `invalidated` 记录移动到 `archive/<impact-area>/`，并同步修复移动造成的相对链接变化；`amended` 和 `superseded` 继续留在原影响面。
7. 当前行为规则有独立 owner 时同步更新 owner，让决策记录解释原因而不是复制全部现行规范。

### 5. 使用 CLI

从 skill 目录或使用绝对脚本路径运行：

```text
node scripts/decision-records.mjs check --root <workspace-root>
```

不写命令时默认执行 `check`。常用命令：

```text
node scripts/decision-records.mjs list --root <workspace-root>
node scripts/decision-records.mjs list --all --root <workspace-root>
node scripts/decision-records.mjs list --status amended,superseded --root <workspace-root>
node scripts/decision-records.mjs sync-index --root <workspace-root>
node scripts/decision-records.mjs sync-index --write --root <workspace-root>
```

1. `check` 检查目录、文件名、正文状态、归档位置、链接和活动索引。
2. `list` 默认只显示 `active`；使用 `--all` 或 `--status` 查看历史。
3. `sync-index` 默认只检查活动索引是否漂移；只有 `--write` 会重写索引末尾的 `## 活动决策`。
4. 使用 `--decisions-dir <path>` 检查非默认目录。
5. 根据错误逐项修复，再运行 `check` 到退出码为 `0`。

### 6. 交付

1. 列出实际读取、新增、修订或改变状态的决策。
2. 说明当前任务因此沿用了哪些有效判断。
3. 报告校验命令和结果。
4. 没有写入时说明门槛不足、尚未确认或当前任务仅要求只读检查。

## 边界

1. 使用可直接查看的 Markdown、相对链接和文件名状态表达长期记忆。
2. 让 Git 或其他版本控制系统承接审阅与演进历史；CLI 不保存扫描结果，写入只发生在显式调用 `sync-index --write` 时，且仅更新活动索引。
3. 不把完整对话、操作日志、提交摘要或未确认推断当成决策。
4. 不记录密钥、令牌、敏感个人信息、私人路径内容或未来判断不需要的环境标识。
5. 不让脚本评价决策质量、事实真实性或用户意图；这些判断由使用本 skill 的 agent 和用户共同完成。

## 完成标准

1. 决策内容公开可读，并能从索引按影响面定位。
2. 当前有效性和演进关系可以从文件名、正文状态及链接直接判断。
3. 新旧决策、索引和当前 owner 保持一致。
4. CLI 检查通过，活动索引只显示 `active`，`invalidated` 记录位于专用归档目录。
