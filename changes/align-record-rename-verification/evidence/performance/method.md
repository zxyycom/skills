# Rename / discard 分阶段性能证据

本目录是本次 Change 的短期、可 Git 恢复证据，不是永久 benchmark 或产品调试接口。

## 冻结与输入

- before：精确 Git `66cf190967fd9ea7a0654412c29c955801951923`，DR 91 / IR 80；`setup.py` archive 源码、生成运行时与入口，独立复制全部宿主依赖，不安装。各 CLI 样本前验证来源 manifest；`collect.py` 再验证源码、插桩源码、依赖未漂移。
- after：等待本次实现与生成自验稳定再冻结；after 仅冻结批准的产品 owner 源码、两 skill 完整分发树及 root package/lock 配置，避免其他任务编辑无关 skill 造成伪漂移；before 宽 archive 不变，另派生完全同 scope manifest。具体源码 hash 见 `manifests/source-after.json.gz`（生成后存在）。两侧都执行各自真实分发 Node CLI，而非直接调用 SDK 或模拟 prepare。
- 正式输入：每域 10,000 formal / 9,000 directed relations / 2 candidates；全 fixture 20,007 文件，包括 IR 一个未选 owner 的一个资源。所选 `261001-record-10000` 没有资源、没有入边，具有一条出边。rename 实际是一个身份旧/新路径两项 delta，加一个索引；discard 是一个正文删除，加一个索引。不是大 fan-in / 大实际写集性能证据。IR discard 的第二个 planned write 是事务 tombstone，不是第二份最终正文变更。
- 1k 自证输入：每千块保留末 100 条，共 1,000 formal / 900 relations，候选仍每域 2 个，移除不再存在的资源 owner；先独立同步、提交隔离 fixture、再运行两个领域 check，见 `probe-legality.json`。
- `fixture-recipe.json.gz` 不是完整大 fixture：13 个正文模板、9 个 index-entry 模板与完整输入文件 hash/mode/模板映射。`reproduce-fixture.py <不存在的目录>` 已实际逐文件重建、验证全部 SHA256、Git tree 与原始 HEAD `9fdb438df1f4e33722cf6eb131983ba071930d75`。它不需网络；精确 before/after 程序另从对应 Git 来源恢复。

## 测量与边界

- 每版本、每正式场景 normal 2 次、instrumented 1 次；四场景共 12 CLI / 版本。normal 逐值报告，instrumented 绝不加入 normal 统计。不补跑或挑选较好值。
- 每次全新 Node 进程，wall 包括 launch/import/worker startup、完整公开 CLI 与退出；reset、chmod/hash、独立后验均在计时之外。无 cache drop；reset/source proof 会预热文件；不是 cold-cache 实验。before/after 是同输入配对、按版本成块执行，不是随机交错实验。
- 主任务 agents 的重任务在正式窗口暂停；其他共享工作区负载不可完全控制。仅两次 normal，不能提供可靠置信区间或跨机器承诺。
- CPU/RSS 来自 `os.wait4` 的 Node child rusage；worker threads 的 CPU 属于同进程，不拆成独立重复样本。不报告每阶段 CPU、worker 内部阶段或 syscall 数。
- 插桩只修改隔离冻结运行时。精确单次 anchor、Promise 返回类型尖括号平衡与顶层函数边界断言定位；修改后以 Node `stripTypeScriptTypes` 显式解析；patch、具名函数位置映射、完整插桩 manifest 均保留。每个 interval 用 `try/finally` 收束；不在逐文件 I/O 热循环写 trace；进程退出后一次写出。
- `trace-preload.mjs` 只在主线程输出 trace；worker import 边界照常存在。额外 preload/import、时间戳与写出成本属于 instrumented wall。normal 与 instrumented 差值同时受环境波动影响，不能叫作纯 instrumentation overhead，也不以之修正阶段时间。
- shared prepare / fresh / preverify / write-loop / resources / publish / shared postverify / domain postverify / cleanup 直接取现有执行边界。其他 domain 具名 interval 是包容区间；不能和子阶段相加。`summary.json` 同时保留 inclusive 和扣除直接子区间的 exclusive 值，并验证父子包含、兄弟不重叠、trace 全闭合。
- `freshPlusSharedPreverify`、`sharedPlusDomainPostverify` 用于义务范围比较：after 的同阶段来源采集可能移入共享 phase，不能只以 shared-pre 单项下降归因。`externalAndUnattributedResidual` 包括未插桩的 canonical/history/preparation/CLI launch/import/输出等，不冒充纯 prepare。
- 每对 normal/instrumented 验证完整输出文件 manifest 和 stdout/stderr SHA256 精确相同；这是本次成功输入的副作用等价证据，不是所有失败路径的仪器等价证明。

## 独立后验与失败留存

`historical-audit.py` 的 `verify` 是既有审计的有界复用，`measure.py` 拥有本轮执行：验收完整期望 index、每条 sourceRevision、每份来源身份、精确关系图、文件 membership、所有未选 bytes/mode（含未选资源）、所选目标 mode、rename body/metadata 保持、旧身份/旧路径退出、Git HEAD 与 pending 不变。它检查文件成员，不把空目录拓扑或原子隔离当成已证明。

第一次自证准备错误独立保留在 `probe-attempt1-*` 与对应 raw：DR 仅删根目录而非 archive，误成 9,100；插桩曾把返回类型对象大括号误认为函数体，CLI 语法失败。均发生在正式窗口前，已修正，**不作为性能样本**。修正后 before `probe2-*` 与 after 各八个自证样本全通过，共 16；正式样本共 24，均通过，无正式失败或补跑。

## 复核入口

- `import-closure-*.json`：真实两 entry 的 import-only 解析观察（不执行 CLI），以及完整 scripts 树 strip-types 后的静态/literal 动态 import、URL（含 worker）存在与 scope 检查。无来源边界逃逸；外部依赖只来自独立冻结依赖。
- `product-after.patch`：精确 baseline 与 frozen after 同 scope 源码/生成物差异，配合 manifest 恢复当时输入。`recover-after.py` 已实际从 baseline 应用补丁并按 manifest 恢复 mode，完整 1,281 文件相等；源码 mode 表示差异不当作代码行为变化。
- `results.jsonl`：逐样本 wall / CPU / RSS、输入输出与 stdout/stderr hashes、后验结果。
- `raw/`：小 stdout/stderr 与 interval trace（包括失败尝试）。
- `summary.json`：由 `collect.py` 派生，含 planned / unchanged / guards 与真实最终文件 delta。
- `audit.json`、`manifests/`：raw hash、阶段闭合与来源/依赖未漂移审计。
- `before-window.json` / `after-window.json`：实际窗口 UTC 与授权范围；窗口耗时不是 CLI wall。
- `archive-inventory.json` / `audit-archive.py`：结项前 inventory，并可在 Git 恢复后无 `/tmp`、无依赖、无产品执行地核对全部归档 raw 与 manifest、样本数和等价关系。
- `setup.py` / `fixtures.py` / `instrument.py` / `measure.py` / `collect.py`：最小复核流程；私有路径与 fixture 克隆都是受 marker 保护的本次辅助物。当前路径常量明确记录原执行位置；重现时改为新的隔离目录，不触碰原只读 fixture 或真实项目。
