# 选择性内容读取与 Pending Snapshot

本文件承接版本管理中间层的专用选择性内容读取、身份保护与条件替换；通用入口及错误恢复见[版本管理中间层](version-control.md)。

## 完整验证与选择性内容保留

共享层分别声明身份保护、payload 验证与内容保留范围。下方 pending snapshot 默认完整验证，
也允许消费者显式选择所需 payload；revision prefix 始终完整验证所选对象。
这些专用子模块不改变通用 full-read/full-replacement 默认入口。

## Blob 指纹模式

内部批量读取可只保留完整内容、有限前缀或零字节；保留量不减少所选对象的完整 payload 读取和验证。pending snapshot 使用覆盖完整实际 payload 的 SHA-256 指纹，普通完整读与 revision prefix 不计算该指纹。两者均检查对象身份、类型、长度、帧、结束与输出预算；缺失、腐败、输入或进程失败都阻断读取，Git OID 不能代替实际 payload 指纹。内部具体 reader 接口见 `git-blob-batch.ts`，不扩张通用仓库入口。

## Pending snapshot

`pending-snapshot.ts` 提供 `readPendingSnapshot(repository, { pathScope, contentPaths, payloadScope? })`、`samePendingSnapshots`、`extendsPendingSnapshot` 与 `replacePendingSnapshot`。

读取始终核对 scope 内完整成员及其唯一文件表示，返回全部成员的 `path`、`kind`，仅保留显式 `contentPaths` 的字节。`PendingPayloadScope` 决定实际 payload 的读取、指纹与失败边界：

| `payloadScope` | 验证责任 |
| --- | --- |
| 省略或 `scope` | 验证 scope 内每个 unique 对象的完整实际 payload。 |
| `content-paths` | 只验证 `contentPaths` 对象的完整实际 payload；其余成员以完整路径、模式及对象 ID 保护身份，不验收其即时可读性与内容指纹。 |

- **身份与比较**：共享层保存完整成员身份及策略内 payload 的实际指纹。比较须使用同一 repository 实例、scope 与 payload 策略取得的原始 opaque snapshot；`content-paths` 还要求 `contentPaths` 集合相同，默认 `scope` 允许不同的内容保留集。普通对象不能代替原始 snapshot，调用方不得修改返回的内容字节。
- **同阶段扩展**：`extendsPendingSnapshot(before, after)` 只比较两个原始 `content-paths` snapshot，不执行 I/O。它要求同一 repository 实例和 scope、完整路径/mode/OID/stage 身份相同、before 的选择（含缺失路径）全部保留、此前实际 payload 指纹全部相同。用于先读必要索引定位再扩大所选 payload；不放松 `samePendingSnapshots` 的精确选集比较，也不代替后续 fresh 或锁内 CAS。
- **替换与发布**：调用方提供原 snapshot、当前 revision 期望和显式 updates（文件或 `data: null` 删除）。`content-paths` 的 updates 必须位于原 `contentPaths`，避免写入扩大验收边界。边界取得更新目标的自有字节，变化路径与写入内容使用同一目标。锁内核对完整成员身份及策略内的实际内容指纹，只更新声明路径并保留其余条目；写后按相同策略验证目标再发布。范围外由原事务复制保护，失败及恢复服从范围替换契约。

Decision Records 与 Investigation Report 的内部记录暂存协调器在所有 stage scope 显式选择 `content-paths`：index 只选目标索引，all/domain 由领域限定所选来源、更新路径、资源与必要定位索引。其他消费者仍按自己的显式选择或默认完整 payload 契约执行。领域 scope 策略与阶段顺序由 [Index Runtime](../index-runtime/README.md#记录领域的内部暂存协调)承接，共享版本管理层不识别记录身份或资源 owner。

## Revision prefix

`revision-file-prefixes.ts` 的 `readRevisionFilePrefixes(repository, { revision, paths, prefixBytes })` 接受固定 revision 与显式路径；返回有限字节前缀，并以 `complete` 表示是否为完整内容。不存在的路径省略，表示或对象读取错误失败。前缀不足以决定领域语义时，消费者以同一 revision 显式补读该文件。

前缀足够时也校验所选对象的完整 payload，后段腐败仍是读取失败。完整范围成员、payload I/O 与物理事务复制成本继续存在；Git 批量读取的 stdout、stderr 各自保持 256 MiB 完整输出预算，有限保留不扩大预算。替换仍复制完整物理 index，以保护范围外状态。
