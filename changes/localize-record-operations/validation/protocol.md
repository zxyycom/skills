# 测量、复核与重放协议

## 阅读与身份

- `matrix.json`：23个场景的精确业务argv、初态与预期退出码。两域各10k存量；两个bootstrap为0正式。
- `samples.jsonl`：93个真实计量进程，保留原验证结果、完整输出身份、wall/CPU/RSS、初末状态身份与有效分类；92个有效，1个非法方法输入。
- `summary.json`：每场景3normal的min/median/max；probe成本另列，不参与正常统计。
- `effects.jsonl`：完整W/P原始清单SHA及小delta（bytes/mode/SHA、P mode/OID）；原始大清单只在临时区。
- `workloads.jsonl`：23个独立probe的成功Node API读次数／返回字节／unique路径，Git完整batch framing及必要对象关联。
- `corrections.json`：4次同进程方法误判纠正、1次非法输入及追加有效样本、准备命令取消和重放recipe准备纠正；没有删样或覆盖原进程。
- `controls.json`、`provenance.json`：10个不计时对照、环境、起止指纹、输入重建证明、与旧基线可比性及机械审计。
- `replay-bundle.tar.gz`、`replay-index.json`：形成时方法和按SHA去重的完整stdout/stderr字节。压缩包不含大fixture、索引、依赖或10k逐样本清单。

## 计量边界

采用原字节wait4 collector（SHA-256 `7aa0d83598b9bb55007a94e621b2b0623b5f008f6f25f66a0f1955e81d8f28a7`）。按正序／反序／正序运行3normal，再分别probe；每次恢复独占合成Git工作区，无remote、hooksPath=/dev/null，隔离系统／用户Git配置。各次新Node进程，清空继承NODE_OPTIONS、NODE_PATH、编译缓存／覆盖率配置；Bun只在维护启动时临时PATH前置1.4.2，不改全局。

计时从启动前至退出并回收，包含模块加载、完整CLI与输出。CPU为wait4 user+system，可包含该口径计入的已等待后代。Linux ru_maxrss是进程高水位，可能体现已等待子进程中的最大单进程值；不是同时整个进程树RSS总量峰值，也不是JS heap。600秒限时仅终止本次进程组；全部原输出保留，未截断。正常／probe输出逐字节相等；DR发布仅精确归一晋升C的createdAt及其已独立验真的派生revision，保留原值及归一说明。

原字节Node preload经sync、promise、callback、FileHandle、partial read、独立worker、重复OID和Git framing合成自检。普通成本没有preload。计数是成功完成的Node数据API返回量，嵌套高层／底层调用去重；不是syscall或物理I/O。Node loader内部、Git内部文件I/O、mmap及原生直读不在FS hook覆盖内；实际数据读取方式已核对当前reader／版本控制入口，本轮未知部分字节事件为0。

Git完整payload按真实framing计数，不拿保留prefix估算。H/P角色为初态OID成员关联，可重叠，不能相加或当调用阶段。新写OID只在独立最终P存在相同OID/size时补path/SHA关联，保留初始unknown；无法归属或指向未选对象仍失败。IR有前序publish的09999是明确必要历史依赖，只允许其历史对象，不扩大当前FS正文许可。归属标签不支持阶段耗时推断。

独立后验使用Python C YAML解析和独立长度前缀SHA算法，逐项比较索引投影/sourceRevision、完整W文件bytes/mode、完整P内容SHA/bytes/mode/OID与HEAD；不以产品check作为唯一判据。scope index只要求索引组合及范围外P身份保持，不假设P正文已配套。原准备核验投影／revision／资源引用，不声称覆盖全部正文节语法；非法IR资源节样本单独保留。

## 重放路径

先核对包SHA及每个成员SHA；包中只有普通相对路径文件，无symlink。解包到新的自有临时目录，禁止覆盖现存测量材料。完整方法保留形成时的绝对源码位置、原始路径和历史纠正脚本；它们是此次验收材料，不是项目长期CLI或测试入口。

在相同Node/Git/Python（含PyYAML）及依赖、源码／生成版本下，可按以下主路径恢复最终合法输入并重跑23场景；不执行历史纠正脚本，不重跑全集check：

1. 从本目录复制matrix到临时根的preparation/matrix.json；从provenance的originalTemplates写出preparation/fixtures.json。
2. 执行 `python methods/recreate-inputs.py <临时根>/recreated-inputs` 和 `python methods/init-recreated-templates.py`。这两个命令在本轮已实际执行，重建20,007文件的字节／mode与两个Git HEAD逐项相等；不依赖旧/tmp fixture存续。
3. 执行 `python methods/freeze.py`，核对所得指纹与本次provenance；不一致时先说明环境／源码差异，不宣称严格复现。脚本不安装依赖。外部supports-color也须按记录路径与7文件SHA独立核对；本轮已有始末证据。
4. 执行 `python methods/prepare-final.py --skip-product-check`，再 `python methods/run.py`。当前recipe已直接生成修正后的IR资源节；新重放为92次，不人工制造原来的非法方法输入。最后可执行 `python methods/controls.py`。

相同绝对工作区路径／日期才可能重现原输出路径／动态身份字节；使用新根路径或其他日期时必须区分这些差异，不能伪称原输出SHA相等。wall/CPU/RSS本就不能要求逐次相等。归档中的原始完整输出可不启动产品直接校验SHA。

原始大型材料位于本轮自有 `/tmp/localize-record-acceptance-20261024-j2I1x1`，保留到主代理交接审计完成；历史报告、旧/tmp来源和基线fixture未修改或删除。冷缓存、并发故障、十万条、大正文及所有入口矩阵不属于本轮证明范围。
