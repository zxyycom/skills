---
title: "调查暂存的文件表示误判与保真修复"
id: "261005-pending-file-representation-conflict"
formedAt: "2026-10-05T09:51:08Z"
question: "合法可执行附件为何触发 pending-conflict，如何修复且保持真实冲突与执行权限？"
tags:
  - "artifact-integrity"
  - "investigation-report"
  - "version-control"
relations: []
---

## 形成时背景

本轮从仓库 bb1a841a 的当前代码与 investigation-report v58 出发，复核合法可执行资源触发 pending-conflict 的反馈，并实施保真修复。最初仅核对共享实现、分发脚本与内存数据，没有重跑真实调查暂存。原现场的 220 个条目与两个脚本属于用户提供的背景，本轮不把它们当作已重新读取的现场状态。

共享层既有契约要求普通非可执行期望并统一构造普通目标；调查 all/domain 则重建整个范围，未选报告的资源也进入期望与目标。本轮检查跨越共享表示、领域组装与生成交付，重点是闭合误判和执行权限丢失的同一因果链。

## 调查目的

确认误报机制，修复 all/domain 的可执行附件暂存与权限保留，并验证真实的字节、表示和 revision 漂移保护。范围限定为现有 Git adapter 与直接消费者；附件类型、其他后端及打包 hash/ZIP 协议沿用既有边界。

## 调查范围与依据

- [共享 owner](../../tools/shared/version-control.md) 与 [文件类型](../../tools/shared/src/version-control/types.ts) 定义快照及替换边界。
- [期望比较](../../tools/shared/src/version-control/git-pending-values.ts) 原先将每个条目模式与固定普通模式比较；[目标重建](../../tools/shared/src/version-control/git-pending.ts) 也只复用普通模式，其他条目按普通模式重建。
- [调查范围组装](../../tools/investigation-report/src/staging-domain.ts) 从整个 pending 范围建立目标；原先以路径到字节的 Map 重组，不能传递文件表示。[来源读取与漂移核对](../../tools/investigation-report/src/staging-domain-writes.ts) 原先也只读取与比较字节。
- 修复前的内存单变量对照使用 220 个相同路径、stage-0 条目：全为 100644 时返回 true；只把 measure.sh 与 summarize.py 两项设为 100755 后返回 false。它证明固定模式限制，但不是原现场的全量重演。
- 修复前运行 `bun run check:investigation-report-check` 通过，证明当时分发脚本与源码一致，而非本地生成漂移。
- 本轮新增 [共享表示测试](../../tools/shared/tests/version-control-representation.test.ts) 与 [调查表示测试](../../tools/investigation-report/tests/staging-representation.test.ts)，在每个 case 私有的真实 Git 仓库中检查模式、对象/内容、冲突拒绝和完整 index 恢复；不对主仓库执行测试暂存。

## 调查结果与边界

已确认因果链：整个范围的合法可执行资源被读取成只有路径与字节的快照，锁内期望比较再把它们与固定普通模式比较，导致误报 pending-conflict；如果只去掉这个限制，重建仍会降成普通模式。因此放宽接受范围不足以证明修复。

修复让快照携带 `regular`、`executable`、`symlink` 表示，由 Git adapter 映射底层模式；读取、归一化、期望比较、复用、写入和读回均保真。共享层按 `core.fileMode` 读取所选常规来源的有效执行位，未选 pending 字节与表示保持原样；表示变化参与漂移核对和变化报告。所选来源继续要求非符号链接文件。

新增 12 个最小测试节点覆盖可执行/链接保真、仅表示漂移拒绝、all/domain 保留未选快照、新增和修改脚本、仅执行位变化及来源安全边界。读回恢复测试实际改变锁定目标的模式，验证失败时保留完整原 index；工作区测试覆盖关闭执行位策略时的未合并条目与链接表示。验证结果如下：

- `bun run test:version-control`：36 项通过；`bun run test:index-runtime`：59 项通过。
- `bun run test:investigation-report-check`：224 项通过；`bun run test:decision-records-cli`：281 项通过。
- `bun run test:task-graph-cli`：88 项 Bun 测试及 4 项 Node 原生测试通过；`bun run test:skill-package-hash`：12 项通过。
- `bun run test:check`：44 项通过，包含新增调查测试接入语义检查入口的覆盖核对。
- 五个受影响分发工具均通过公开 sync 入口重建；对应 skill 版本为 change-plan 30、decision-records 69、investigation-report 59、task-graph 21、test-evidence-review 31。
- `bun run check` 与 `bun run check --tag release` 均通过。发行门禁 66 项检查全部通过（含增量复用），涵盖类型、lint、格式、生成一致性、测试证据、领域行为、独立版本和打包。`git diff --check` 通过。

证据覆盖仓库源码、本轮重建制品及隔离 Git 仓库行为；原现场暂存与安装更新未重演。POSIX 执行位和符号链接来源仅在非 Windows 环境验证。原现场更新后若仍失败，应重新区分字节、表示或 revision 漂移、写入边界忙碌和来源安全问题。
