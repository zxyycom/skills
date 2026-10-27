# Git hook、CI 与发布操作

本文承接启用 hook、核对远端合并保护和聚合发布的精确操作与验收。先读[项目工具链](tooling.md#git-hook)理解交付主线；任务需要时再读取相应章节。 Hook 在本地 commit 前后执行，授权的自动推送不等于手工推送；远端 CI 和聚合发布分别以受测 revision、产品门禁和制品一致性证明交付。合并保护须在远端另行配置并验证，不能从本地验收或 workflow 声明推断。

## Git hook

### 启用与授权

标准 `node scripts/environment.js setup` 会启用当前 worktree 的整组仓库 hook。只需要单独恢复平台 hook 条件或 `core.hooksPath` 时运行：

```bash
bun run setup-hooks
```

当 `core.hooksPath=.githooks` 且当前平台所需的 hook 文件条件已经满足时，仓库 hook 视为已启用。启用即表示使用者预先授权下文定义的 `post-commit` 自动推送；agent 获得当前 commit 授权后，不需要再次索取该自动推送的授权，也不主动绕过 hook。当前任务明确要求停用或限制自动推送时，该要求优先。

该授权只覆盖 hook 自动调用 helper 后产生的精确外部写入，不覆盖手工调用 helper、手工或强制 push、其他 remote/ref。由于启用动作建立持续的自动外部写入，setup 入口继续属于需要使用者明确选择的有副作用命令。

### Hook 行为

`.githooks/pre-commit` 通过 `hash:skills --quiet` 只读检查 Git index；包内容变化但对应 `metadata.version` 未提升时命令失败。该 hook 不写文件，也不自动 stage。

`.githooks/post-commit` 在 commit 已经完成后调用 `scripts/auto-push.ts`，其边界如下：

1. **目标条件**：仅当当前 symbolic branch 是 `main` 且存在 `origin` 时进入推送流程；其他 branch、detached HEAD 或缺少 `origin` 时跳过。
2. **更新方式**：只执行非强制的 `refs/heads/main:refs/heads/main` push；Git 的普通 fast-forward 规则拒绝远端分叉或其他非快进更新，不改用 force、其他 branch 或其他 remote。
3. **频率上限**：自动推送按尝试节流，而不是按成功结果节流。helper 在发起 push 前，以 Git common dir 共享的 `refs/codex/auto-push/last-attempt` blob 保存毫秒时间戳，并用 `update-ref` compare-and-swap 协调 linked worktree；同一仓库滚动一小时内至多保留并发起一次尝试。
4. **失败结果**：网络、权限或远端冲突造成的失败也占用当前一小时窗口；节流状态无法可信读取、解析或更新时不推送。helper 返回失败并输出诊断，hook 吸收该状态，因此已经完成的 commit 不回滚。
5. **后续触发**：hook 不创建 timer 或后台重试；窗口结束后的下一次符合条件的 commit 才会再次尝试，并推送届时 `main` 累积的提交。

节流 ref 不属于 `main`，上述显式 push refspec 不会发布它。GitHub Actions 不能修改已经 push 的 commit；PR 合并阻断还需单独配置并核对下文的远端必需检查。

### 平台与 Git 环境

Hook 源文件通过 `.gitattributes` 固定使用 LF，并在 Git index 中保存为 `100755`。POSIX Git 会检查工作区执行位，因此 setup 对当前 worktree 的 `pre-commit` 和 `post-commit` 重新执行 `chmod 0755`；原生 Git for Windows 的 `access(X_OK)` 兼容层忽略 `X_OK`，因此 Windows setup 不把 `chmod` 当作启用机制，而是依赖 LF 脚本存在且 `core.hooksPath=.githooks`。环境测试使用真实 `git commit` 验证两类 hook 被调用，并以启用 checkout 换行转换的 clone 验证 LF 契约。完整 Gate 的持续验收位于 Linux；Windows 视频 job 不承担全仓环境或所有 hook 的平台资格证明，平台结果仍以实际执行范围为准。

Git 调用 hook 时会注入当前 worktree 的 `GIT_DIR`、`GIT_INDEX_FILE` 等 repository-local 环境变量。两个 hook 在取得当前顶层路径后先清除 `git rev-parse --local-env-vars` 声明的变量，再从该顶层运行各自 helper；这样 nested Git 会重新识别当前 worktree、共享 common dir 及其正确 index，而不会继承 hook 调用点的局部覆盖。

## CI 与发布

### 任务交付与远端验收

日常任务以适用的本地验收为交付依据，远端 CI 默认异步；远端合并与聚合发布各自满足对应门禁：

| 层次 | 完成依据与执行边界 |
| --- | --- |
| 日常反馈 | `bun run check` 提供 quick 反馈，不代替完整变更验收。 |
| 本地任务交付 | 按[仓库验证要求](../AGENTS.md#验证与交付)完成对应改动范围的本地验收后，凭本地证据交付任务结果；远端 CI 通常异步运行，不默认等待整个 workflow 结束，也不默认增加本地全量 release。 |
| 远端合并／聚合发布 | 下文的 Linux／Windows 产品门禁、job 依赖与实际生效的远端必需检查约束对应合并或发布动作，不自动成为每次 agent 任务的同步等待条件。 |

需要远端证据的任务（例如修复 CI、验证远端发布或补足本地无法验证的平台边界），等待对应 revision 的必要 job 与制品结果。等待范围由任务的证明责任决定；创建 Change、修改 Gate 或触发 workflow 本身不增加等待义务，本地 full／release 同样按实际改动的证明责任选择。

已知相关 CI 失败在授权范围内处理；无法解决时报告失败、影响和剩余验证。交付分别说明本地结果与远端已知状态；所需远端证据未取得时，该项验收保持未完成，未查询、运行中或缺失的结果均不声称通过。

### 聚合发布流水线

`.github/workflows/package-skills.yml` 使用同一受测 revision，按两类产品门禁组织流水线：

| Job | 范围与责任 |
| --- | --- |
| `package`（Ubuntu） | 固定工具链下的完整 release Gate，覆盖全仓质量、结构、类型、Case/index、联合同步、事件基线版本/hash 与全部 skill 打包；上传 `skills` artifact。 |
| `video-windows`（Windows） | 依赖 `package`，checkout 其输出的 `tested_revision`，下载同次 workflow 的 `skills` artifact，以 `accept:video-windows` 验收视频源码和其中的实际视频 zip。 |
| `publish` | 同时依赖 `package` 与 `video-windows`，保留既有发布触发条件；任一门禁失败、取消或缺失成功结果均不能发布整批 skills。 |

两个产品门禁覆盖每次现有 PR、main push 和手动打包 workflow，包括仅修改共享依赖或其他 skill 的情形。必需验收保持实际执行，不以路径过滤或成功跳过替代。Windows 视频失败也阻断未改动 skill 的聚合发布，以沿用一条发布链；取舍见[平台验收决策](decisions/require-windows-video-acceptance-for-aggregate-release.md)。

Linux `package` 复用本地稳定入口：

1. 安装固定 Bun、Node、pnpm 和 Go，执行 `pnpm install --frozen-lockfile`。
2. 在同一 package job 安装 SCC 4.0.0，并在运行门禁前精确探测版本；函数指标无需额外分析器。
3. Checkout 后先确认非空、非全零的事件基线在本次仓库历史中可解析；不可解析时明确失败，不能把 force-push 前的基线悄悄替换成 `HEAD`。随后运行 `bun run check --tag release --cold --baseline-ref <event-baseline>`，在唯一 Gate aggregate 内完成前置检查、相对事件基线的独立版本校验和全部 skill 打包；只有事件未提供有效基线时省略该参数，release Gate 才回退 `HEAD`。
4. 运行 `bun run hash:skills --github-output --baseline-ref <event-baseline>`，重复廉价版本校验并输出本次聚合 hash；该步骤位于已经通过的 release 终结 Check 之后，不能绕过发布版本门禁。
5. 上传全部 `dist/*` 作为保留 7 天的 `skills` workflow artifact，供当前 workflow 的 Windows 验收、发布或短期 PR 核对使用。两类门禁均成功的 `main` 构建才进入发布 job；发布器对照远端资产的名称、大小和 SHA-256 digest，完全一致时不执行远端写入，从而在先前含 skill 改动的构建失败后由下一次成功构建补发。
6. package job 失败且存在 Gate invocation 时，额外上传保留 3 天的机器结果、progress 与命令 transcript，供定位失败 Check；不上传可复用 cache。若事件基线已不可解析，可在 `main` 手动触发 `workflow_dispatch` 重新验证并重新发布当前制品；它不会恢复已丢失的历史基线比较。

Windows 组合入口、独立安装与测试维护见[视频工具维护](../tools/video-understanding/README.md#windows-开发与制品验收)。该入口须消费同次 Linux 打包的原 zip；重新打包或工作树副本属于不同的验收对象。

fixture 的证明范围限于实际断言的入口、路径、资源、配置、依赖、更新与进程行为。实际媒体、网站、OCR 模型及客户端发现按具体任务授权另验，其他 skill 的平台范围保持不变。

### PR 合并保护

维护者在首次配置或 workflow job 身份变化后完成以下核对：

1. 取得当前平台上 `package`、`video-windows` 的实际 check 身份与受测 revision。
2. 将二者同时设为远端 ruleset／分支保护的必需检查，验证失败、取消或缺少成功结果时均阻止 PR 合并。
3. 保存实际配置与阻断证据。尚未配置、权限或平台能力不足时，明确报告远端保护未证明生效，等待授权或配置后再核对；本地验收通过不能声明 PR 已受保护。

YAML 的 job 依赖约束发布；远端合并保护以本节生效核对为准，本地测试和文档声明不代替该证据。

### 发布职责与输入

1. workflow YAML 只承接触发条件、权限、job 依赖和运行时准备，不实现发布事务。
2. `scripts/publish-skills.ts` 是薄 CLI 入口，`scripts/lib/publish-skills.ts` 是唯一发布实现 owner；实现内部按命名单元处理输入、资产、Git/`gh` 边界、GitHub 响应和发布顺序。
3. 发布 job 从仓库根目录调用 `bun run publish:skills -- <rolling|snapshot>`。CLI 从 `dist/` 读取 zip 与 manifest，并要求 `GH_TOKEN`、`GITHUB_SHA` 和 `PACKAGE_HASH`；输入或资产无效时，在执行 Git 或 GitHub 命令前失败。

### 发布触发与结果

发布 job 只在 `main` 上运行，触发与结果如下：

| 触发条件 | 发布结果 |
| --- | --- |
| `pull_request` | 不发布 Release；只保留短期 workflow artifact。 |
| `main` push 且当前制品与远端资产不同 | 更新 `skills-latest` 的 tag 与完整资产集，并把该滚动 Release 标记为 GitHub Latest。 |
| `main` push 且当前制品与远端资产相同 | 发布 job 只读核对后跳过远端写入。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=false` | 核对并按需同步当前制品到 `skills-latest`，不创建历史快照。 |
| `main` 上的 `workflow_dispatch`，`publish_snapshot=true` | 核对并按需同步 `skills-latest`，再为当前聚合 hash 创建或核对一个不可变快照。 |
| 非 `main` 分支上的 `workflow_dispatch` | 不发布 Release；只保留短期 workflow artifact。 |

### 发布一致性

`skills-latest` 是正式滚动发布入口和 GitHub Latest，updater 默认读取该 Release。更新已有滚动 Release 时先覆盖各 skill zip，最后覆盖 manifest；全部当前资产可用后才删除不再属于当前制品的旧资产并更新 Release 元数据，使失败后的后续运行能够重新同步。updater 会拒绝 zip 版本与 manifest 不一致的制品，不会把发布中断产生的混合资产写入本地 skill。

滚动发布的无变化判断以完整资产清单、字节数和 GitHub 提供的 SHA-256 digest 为准，不以本次 push 的 Git diff 或 Release tag 所指提交为准；缺失 digest 时保守地重新同步。这样失败构建遗留的待发布内容可由后续成功构建恢复。

不可变快照 tag 使用聚合 hash 前 12 位：`skills-<hash12>`。相同制品只对应一个快照；同名快照已存在时，发布脚本逐项核对资产名称、字节数和 GitHub 提供的 SHA-256 digest，一致则复用，任一字段缺失或不同则失败且不修改快照。显式 `--release-tag` 只用于仍被保留的不可变快照或历史 Release。
