# Design

本设计只描述调查领域怎样把选中的主题源适配为公共索引 state 变化，并在补充同源主题文件后写入 `pending`。

## Context

[`materialize-selected-index-state`](../materialize-selected-index-state/design.md) 完成后，`index-runtime` 拥有“基线 state + upsert/delete + 目标 metadata/`sourceRevision` → 完整派生索引”，且该入口已经由 decision-records 选择性暂存强制接入并通过回归。本 change 沿用其中的术语和责任边界。调查 Markdown 仍是权威源；派生索引不包含报告正文，不能反向生成主题文件。

`revision` 是已提交基线，`filesystem` 是磁盘主题，`pending` 是下一版本快照。这里不使用“Git index”指代领域派生索引。

## Goals / Non-Goals

目标：

- 实现调查路径选择和 source-to-state adapter。
- 计算目标 `sourceRevision`，并构造完整的 companion topic files。
- 保证写入 `pending` 的权威主题与派生索引来自同一目标源集合。

非目标：

- 重新实现索引 overlay 或修改公共索引物化契约。
- 改变调查文件或派生索引格式。
- 让既有命令感知 `pending`，或根据 filesystem 差异自动推断选择集。

## Decisions

1. `stage <topic-path...>` 至少接收一个不重复的 `<category>/<slug>.md` POSIX 路径；重命名显式选择旧、新路径。
2. 调查 adapter 从 version-control revision 的全部主题建立基线 state 与原始 companion file map；指定 filesystem 路径按存在性形成 upsert 或 delete，两处都不存在是参数错误。
3. adapter 对目标原始主题集合计算现有调查 `sourceRevision`。metadata 固定为空对象；主题解析、路径、状态和报告结构继续由调查领域校验。
4. `index-runtime` 根据基线 state 和选择变化物化完整索引；调查领域不操作索引 entry、keys 或 JSON hunk。
5. 调查领域把完整目标主题 file map 与生成索引交给 `replacePendingFiles`。最后一次成功调用决定完整 pending 调查范围；filesystem 与范围外 pending 不变。
6. version-control revision 无调查集合时使用空基线；显式删除最后一个主题可以得到合法空索引。revision 范围含索引和合法主题之外成员时失败。
7. 参数错误退出 `2`，领域、环境、冲突或写入失败退出 `1`；恢复语义完全沿用 version-control owner。

## Risks / Trade-offs

- 公共层不操作主题文件，但当前调查契约要求 pending source/index 同源，因此 adapter 必须补充完整目标主题集合。
- 最后一次 stage 不累加此前同领域选择；文档与输出必须明确完整替换。
- 自定义调查根必须位于版本仓库根之下；否则无法形成受控 pending 范围。

## Open Questions

无。
