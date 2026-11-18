# 资源记录示例

本页提供一个可在独立工作区验证的共享场景；字段契约见[记录模型](record-model.md)，命令契约见 [CLI 操作](cli-operations.md)。

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
resource-records list --brief --root .
resource-records list --tree --root .
resource-records show demo-form --root .
resource-records show demo-image --version v2 --member main --root .
resource-records trace demo-image --version v2 --type version-parent --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
resource-records trace demo-image --version v2 --member main --type input --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
resource-records trace demo-pack --version v1 --member main-view --type member --direction upstream --depth 2 --max-nodes 20 --max-edges 20 --root .
```

slot 查询返回声明该 slot 的集合及索引中的选择快照；两种视图用于浏览，`show` 回读当前源记录并核对新鲜度；三条 `trace` 分别追踪版本沿革、文件输入和图包别名。检查 `truncated`、`unexpandedTerminals`、证据及 `freshness`，不要把有限结果当全图。

## 逻辑入口示例

另存以下独立资源记录；集合需存在。路径仅为占位，不证明目录或文档存在。此版本代表可演进入口，不是确切文件快照；需要精确选用的文件仍另行登记。

```yaml
---
schemaVersion: 1
kind: resource
id: demo-batch
title: 示例实验批次
collection: demo-form
versions:
  - id: v1
    files: []
    members: []
    entries:
      - {kind: directory, path: projects/demo/experiment}
      - {kind: document, path: projects/demo/experiment/README.md}
---

实验入口；实际调用和观察保留在原说明中。
```

将该记录加入同一隔离工作区，在获准维护时重新运行 `sync-index` 和 `check`。下面分别找实验批次和精确选用，再回读源记录：

```sh
resource-records search demo-batch --metadata --root .
resource-records show demo-batch --version v1 --root .
resource-records list --collection demo-form --descendants --tree --root .
resource-records list --slot appearance --root .
resource-records show demo-form --root .
resource-records show demo-image --version v1 --member main --root .
```

批次的 `entries` 指向可变入口；集合的 `appearance` 选择指向 `demo-image@v1#main`。树中 `[match depth=...]` 是命中，`[context depth=...]` 仅为祖先；索引查询的 `freshness: unchecked` 不证明源记录新鲜，分别以 `show` 核对。目录新增过程文件不必改卡，也不使已有精确文件选择漂移。
