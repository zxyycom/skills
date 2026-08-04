# Design

本设计只描述测试证据领域怎样把选中的 case 源适配为公共索引 state 变化，并在补充同源 topic/case 文件后写入 `pending`。

## Context

[`materialize-selected-index-state`](../materialize-selected-index-state/design.md) 完成后，`index-runtime` 拥有“基线 state + upsert/delete + 目标 metadata/`sourceRevision` → 完整派生索引”，且该入口已经由 decision-records 选择性暂存强制接入并通过回归。本 change 沿用其中的术语和责任边界。topic 表与 case Markdown 仍是权威源；派生 state 不保存完整 Contract、Proves 或正文，不能反向生成 case 文件。

`revision` 是已提交基线，`filesystem` 是磁盘证据源，`pending` 是下一版本快照。这里不使用“Git index”指代领域派生索引。

## Goals / Non-Goals

目标：

- 实现 case 路径选择和 source-to-state adapter。
- 确定目标 topics metadata、计算目标 `sourceRevision`，并构造完整的 companion catalog/case files。
- 保证写入 `pending` 的权威 topic/case 与派生索引来自同一目标源集合。

非目标：

- 重新实现索引 overlay 或修改公共索引物化契约。
- 选择或合并 topic 表变化。
- 自动暂存代码，或让既有命令感知 `pending`。

## Decisions

1. `stage <case-path...>` 至少接收一个不重复的 `<topic>/<slug>.md` POSIX 路径；重命名显式选择旧、新路径。
2. adapter 从 version-control revision 的 topic 表与全部 case 建立基线 state 和 companion file map；指定 filesystem 路径按存在性形成 upsert 或 delete，两处都不存在是参数错误。
3. 已有 revision 证据范围时目标 metadata 固定使用 revision topic 表；首次集合才读取 filesystem topic 表。首版不选择或合并 topic 表变化。
4. adapter 对目标 topic 表和原始 case 集合计算现有测试证据 `sourceRevision`，并在物化前完成 case 格式、ID 唯一性和 topic 归属校验。
5. `index-runtime` 根据基线 state、选择变化、目标 metadata/`sourceRevision` 物化完整索引；领域不操作索引 entry、keys 或 JSON hunk。
6. 领域把目标 topic 表、完整 case file map 与生成索引交给 `replacePendingFiles`。最后一次成功调用决定完整 pending 证据范围；filesystem 与范围外 pending 不变。
7. stage 不解析 `Entry:` 来发现代码文件。代码提交范围继续由调用方或提交整理流程处理。
8. 文本与 `--json` 结果报告选择路径、目标 case 数、catalog/index 路径和 topics；参数错误退出 `2`，其余失败退出 `1`。

## Risks / Trade-offs

- 公共层不操作证据文件，但当前目录契约要求 pending source/index 同源，因此 adapter 必须补充 topic 表与完整目标 case 集合。
- 已有证据范围固定使用 version-control revision 的 topic 表，因此暂不支持在一次 case-only stage 中新增 topic 及其首个 case；出现现实需求后另行设计。
- case 可以独立选择，但对应代码仍需另行暂存；stage 不证明完整代码提交已经形成。

## Open Questions

无。
