---
title: "Git 路径查询超长参数的独立修复"
id: "261021-git-path-query-argument-batching"
formedAt: "2026-10-21T04:47:30Z"
question: "调查报告前序核对为何因批量路径失效，怎样在 Git adapter 内分批且保留查询与失败语义？"
tags:
  - "git-integration"
  - "root-cause-analysis"
  - "skill-tooling"
relations: []
---


## 形成时背景

用户报告 Investigation Report 的 Git 前序核对出现 `ENAMETOOLONG`，并提到 SCC 曾有类似问题。本轮从快照 `36664483` 开始调查：当时 65 份正式报告的全量检查通过，原现场缺少完整错误与运行系统。隔离样本随后复现了批量路径的参数总长故障。

用户选择按工具分别处理，最终把验收重点明确为随 skill 分发、供用户使用的 CLI。本轮修复 Git adapter 的只读路径查询，并核对其他自有分发 CLI 的子进程传输方式。

## 调查目的

定位前序核对的失败边界，区分参数列表总长、单一路径长度与 Git 对象读取问题；在 Git 自身责任内修复，保持字面范围并集、固定 revision、原有记录校验和整体失败语义。

## 调查范围与依据

### 根因对照

调用链为[前序历史核对](../../tools/investigation-report/src/validation-history.ts) → [修订前缀读取](../../tools/shared/src/version-control/revision-file-prefixes.ts) → [Git tree 查询](../../tools/shared/src/version-control/git-revision.ts)。原实现把发现的全部路径一次传给 `ls-tree`。

2026-10-21 在 Linux、Node 26.8.2、Bun 1.4.2、Git 2.53.0 下，通过 `hash-object --stdin`、`mktree` 和 `commit-tree` 建立隔离历史，避免宿主长文件名限制干扰。tree 位于 `docs/investigations/`，包含 `base.md` 和合法的 `report-<五位编号>-<200 个 x>.md`，内容使用同一可读 legacy blob；工作区报告只有一条直接关系指向 `base`。

| 对照 | 观察 |
| --- | --- |
| 100 个历史来源 | 字面 pathspec 连同终止 NUL 共 24,491 字节，核对正常。 |
| 10,000 个历史来源，修复前 | 参数共 2,469,791 字节，最长单一路径仅 236 字节。按目录发现全部路径成功，随后显式全路径查询启动失败：`spawn E2BIG`；源码与分发副本均产生 `history-check-unavailable`。 |
| 同一 revision、同一对象，改用单目录 scope | 10,000 个前缀全部读取成功，排除对象不可读与关系内容导致失败。 |
| 同一 10,000 来源样本，修复后 | 源码与 Node 分发副本均正确确认已记录的 `base`，warning 为空。 |

这些对照直接证明本地 `E2BIG` 来自路径列表的 argv 传输；原现场 `ENAMETOOLONG` 的具体机制仍未证明。

### 用户 CLI 覆盖

盘点实际分发运行时的子进程入口，按传输责任核对：

| 入口 | 本轮确认 |
| --- | --- |
| 六个 skill 共用的 Git adapter | revision 两处、workspace/staged 变化两处、pending 一处字面范围查询均接入分批。其余直接 Git 查询使用单目录、固定元数据或固定长度 commit ID；blob、index 与 hash 的批量内容沿用 stdin 协议。 |
| Change Plan 专用 Git 查询 | 删除预检使用单目录，first-parent 查询使用固定 commit ID。 |
| MCPShell SSH 工具 | shell、patch 和文件内容使用 stdin/stream，argv 为固定脚本与少量路径参数。 |

其余本仓库自有分发 CLI 未发现子进程启动点。SCC 属于仓库门禁依赖，其现有 adapter 独立拆批，本轮未修改；仓库发布与测试维护脚本、外部工具内部实现不属于本轮用户 CLI 覆盖结论。

### 回归与验证

- [Git 路径查询回归](../../tools/shared/tests/version-control-pathspec-query.test.ts)覆盖 revision 列表、完整内容与前缀、workspace、pending、staged 变化、替代 index、空范围、Unicode/引号预算、不可分割输入、批内重复和后续批失败。Trace2 验证实际拆批，较小样本控制常规门禁成本。
- [前序核对回归](../../tools/investigation-report/tests/history-pathspec-batching.test.ts)使用 201 个历史来源，验证源码、分发模块和真实 Node CLI。断言退出码、索引确认、stderr 及多个有界 `ls-tree` 调用，使退回单次超长 argv 的实现即使在宽松宿主上也会失败。消费该入口的 Gate Check 已配置生成前置和 CLI/分发输入订阅。
- 独立端到端对照通过公开 `bun run investigation-report -- --root <隔离工作区> check`，使用两份完整工作区报告和 10,000 个 HEAD 历史来源：退出 0，输出 `2 reports checked; full index current`，stderr 无历史核对不可用、错误未提交提示或长度错误。隔离样本均已清理。
- `bun run test:version-control`（75 项）、`bun run test:investigation-report-check`（299 项）、类型、lint、格式和测试证据检查通过。六个受影响 skill 的运行时已通过所属 `sync:*` 同步及 `check:*` 一致性检查，独立版本已提升。
- 主仓库 `bun run check`：61 passed、0 failed；3 个 release 条件检查未运行。该结果证明检查时的工作树，不代表制品已打包或发布。

## 调查结果与边界

根因是 Git 查询把规范化后的全部字面 pathspec 一次交给进程。报告层将该失败降为历史核对不可用 warning；它既不说明报告内容无效，也不是前序未提交的证据。

修复位于 [Git 私有路径查询](../../tools/shared/src/version-control/git-pathspec-query.ts)，服务 `ls-tree`、`ls-files` 和带范围的 `diff --cached --name-only --no-renames`，由六个 skill 的生成运行时共同使用。内部保守参数预算为 28,000，估算同时覆盖固定参数、UTF-8 argv 与 Windows 转义上界；短输入单批，空 scope 保持一次完整范围查询。完整行为契约由[版本管理中间层](../../tools/shared/version-control.md#git-路径查询的分批传输)维护。

验证边界：

- 固定 revision 在分批前解析，跨批仅合并完全相同的 NUL 记录；批内重复与冲突按各操作原有规则处理。任一批失败拒绝整体结果，不可分割的超预算输入明确失败。
- workspace/pending 保持阶段性读取，写事务仍重新核对；写操作、锁和已有 stdin 协议保持原边界。
- 已在 Linux 验证真实 CLI；Windows 只有编码与转义预算测试，尚无实机证据。预算不探测宿主真实 `ARG_MAX`，异常膨胀的环境变量、单个过长路径、人工超长启动参数及权限故障仍受各自系统边界约束。
- 预算、Git 协议或事务边界变化时需要重新验证；回退需同时恢复源码和六个 skill 的对应生成副本。
