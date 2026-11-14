# 组织、关系与判断

本页是选择粒度的启发式和示例；字段及硬约束以 [记录模型](record-model.md) 和 schema 为准。不要把示例 ID、路径、证据或选择当作真实事实。

## 选择身份和粒度

- 集合是稳定归类：例如伽罗斯为父集合，裂空与烬灭为子集合。tags 可按实际需要跨集合横向筛选，即使标签与层级、版本或用途有关，`parent`、版本和 `selections` 仍分别是对应事实的权威记录。
- resource 对应能独立选用、修改或追溯的对象/制作分支；小步演进可在同一资源中用多个 version。版本中既有文件的身份与内容、图包 members 的目标和顺序固定，不因新候选、位置变化或用途变化而漂移。可在同版追加独立 ID 的附属预览 file，以 `preview-of` 指向确切源文件；仅补预览不必新开版本。
- 同一确切内容新增保管位置，确认一致后给同一文件增加 location；内容修改则另存独立版本及路径，保留旧版。不能确认内容相同就不要当作同一文件；缺媒体不等于未知哈希或未知位置，分别陈述证据与可用性。
- 同版主图及仅用于展示该版的缩略预览可为同版 files，预览用 `preview-of` 绑定确切源文件；裁切若仅随主图展示也可作 derivative。裁片若是实际输入、独立复用或有独立迭代生命周期，可单独成 resource，追溯来源。底图改出新设计是新内容候选：同一制作对象的演进用新版本，需独立选择或长期分支则用独立 resource，并记制作沿革；不把重设计误称预览。以上为判断默认，按真实用途及证据调整，不因尺寸自动分类。
- 图包本身可独立选用时作为 resource，版本的 members 按用途顺序引用确切文件。成员是局部别名，不是新文件：成员目标必须是文件而非另一成员或嵌套图包；需要独立文件身份时回到目标。改变成员或顺序形成新图包版本，旧引用不变。

## 分清关系

`parents` 是版本级制作沿革，不证明具体上传输入或被选用。文件 `input` 是实际输入：每项指向确切文件、原始证据或未知原因，证据定位实际调用条目，`order` 为该输出同次调用的真实顺序。`preview-of` 描述预览对象；`reference` 是参考关系，不冒充实际输入。`members` 是图包有序引用和别名；集合 `selections` 是针对 slot 的用途决定，不是依赖或沿革。各关系和选择引用各自原 owner 的原始证据，例如调用、反馈或资产说明，不反推或改写原始事实。

选择的 `basis`：`agent-provisional` 为代理可逆暂选；`user-preference` 是用户表达的偏好；`user-confirmed` 是用户明确确认的范围。保留 scope 和证据；不知道用户是否确认时不能升级。当前用途由 slot 的明确选择决定，不由最大版本号推断。选择不继承，目标须属于该集合或后代。

## 隔离示例：集合、版本与图包

下列两段分别是完整记录，文件名可为 `collection.md` 和 `resource.md`，只在独立测试工作区使用；真实使用须替换身份、事实与证据。无哈希和位置不表示文件已丢失。示例不声称已有用户确认。

```yaml
---
schemaVersion: 1
kind: collection
id: demo-form
title: 示例形态
selections:
  - slot: appearance
    target: {resource: demo-image, version: v1, member: main}
    basis: agent-provisional
    scope: 示例展示用途
    evidence: {path: evidence/demo.md, locator: 暂选依据}
---

隔离示例集合。
```

```yaml
---
schemaVersion: 1
kind: resource
id: demo-image
title: 示例主图
collection: demo-form
versions:
  - id: v1
    files:
      - id: main
        role: primary
        sha256: null
        locations: []
        gap: 示例未提供哈希和稳定位置
      - id: preview
        role: derivative
        sha256: null
        locations: []
        gap: 示例未提供哈希和稳定位置
        relations:
          - type: preview-of
            target: {record: {resource: demo-image, version: v1, member: main}}
            evidence: {path: evidence/demo.md, locator: 预览来源}
            scope: 缩小展示
    members: []
  - id: v2
    parents:
      - {resource: demo-image, version: v1}
    files:
      - id: main
        role: primary
        sha256: null
        locations: []
        gap: 示例未提供哈希和稳定位置
        relations:
          - type: input
            target: {record: {resource: demo-image, version: v1, member: main}}
            evidence: {path: evidence/call.md, locator: "calls[1].inputs[1]"}
            scope: 编辑时实际输入的主图
            order: 1
    members: []
---

隔离示例；证据路径为占位，不代表真实文件存在。
```

下面是同一隔离示例中的有序图包记录，可与上两段一起校验。两个成员分别指向已登记文件；成员 ID 是图包内别名，`preview` 仍是目标资源的文件，不变成新的媒体副本。真实图包应按实际用途选择成员和顺序。

```yaml
---
schemaVersion: 1
kind: resource
id: demo-pack
title: 示例图包
collection: demo-form
versions:
  - id: v1
    files: []
    members:
      - id: main-view
        target: {resource: demo-image, version: v1, member: main}
        role: 主图
      - id: small-view
        target: {resource: demo-image, version: v1, member: preview}
        role: 预览
---

隔离示例图包，成员按声明顺序排列。
```

示例中 v2 以 v1 为制作前序，另有调用证据声明 v1 主图是实际输入；两条关系分别有其证据含义，不能互相推导。选择仍指向 v1，不因为 v2 出现而变化。占位证据仅为展示结构，不证明调用或媒体存在；真实登记须引用可回查的原始条目。

## 查询示例

将以上三段分别保存为隔离工作区 `resources/records/` 下的 Markdown，已授权维护时先用该工作区执行 `sync-index`、`check`。以下 `resource-records` 代表安装包中实际可执行文件；不在 PATH 时替换为其路径。`--root .` 表示当前目录是示例工作区；可换成工作区绝对路径。

```sh
resource-records list --slot appearance --root .
resource-records show demo-form --root .
resource-records show demo-image --version v2 --member main --root .
resource-records trace demo-image --version v2 --type version-parent --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
resource-records trace demo-image --version v2 --member main --type input --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
resource-records trace demo-pack --version v1 --member main-view --type member --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
```

第一条返回声明 slot 的集合，第二条才读取其选择；后三条分别追踪版本沿革、文件输入和图包别名。检查 `truncated`、`unexpandedTerminals`、证据及 `freshness`，不要把有限结果当全图。
