# 一万条存量定向验收

## Change 完整验收

除下述性能与工作量验收，最后代码优化后独立正确性复核通过 93 个定向节点。完整 `bun run check:changed` 在 Bun 1.4.2 下实际执行 61 项、全部通过，耗时 99.2 秒，3 项 release 检查不适用；运行身份为 `20261024T140245409Z-ffc84415-60f1-499e-8c45-409193a65c3f`。两域分发版本为 DR 94／IR 84，生成副本、独立版本 hash、测试及 1,528 个最小原生测试入口的 Case 覆盖已验收。首轮门禁失败及修复保留在 [design.md](design.md)，不以独立重跑替代完整门禁。

主代理另行读取紧凑验收材料，机械复核 93 个唯一进程、23 组精确成本聚合、23 个读取边界、8 次有效预期拒绝零写、10 个对照、206 份完整输出 SHA、61 个普通相对路径包成员及归档 SHA，全部通过。新增证据后 `check:changed` 再次通过：14 项实际执行、47 项精确复用成功证明、3 项 release 不适用，零失败；运行身份为 `20261024T145834223Z-0a1b23f5-bb51-4004-b2a5-0f0d43087c24`。全部 7 个 Change 的结构检查通过。Git 完成态保存完整目录，随后经 `finalize` 退出当前 Change 集合。

## 结论与证据身份

**通过本轮局部读取及效果验收。**23场景取得69个正常样本与23个独立probe；另保留1个非法方法输入的拒绝，共93个真实计量进程。10个不计时兼容／漂移对照全部通过。有效样本含8次预期非零拒绝，均完整零写；没有被确认的产品读取边界或效果失败。

源码、生成入口及安装依赖共12,303个身份，开始／结束／冻结副本 SHA-256 均为 3d93b1554f38dce7aafac40562e57128935fb91a3e9ba39459c3a391f0038088；外部 optional supports-color 9.4.0的7文件及Node可执行文件亦前后一致。使用 DR94／IR84、Node26.8.2、临时PATH前置Bun1.4.2；4 CPU／6 GiB cgroup，默认heap上限2,248,146,944 B。真实采样窗口：2026-10-24T14:14:50.829988+00:00 至 2026-10-24T14:41:42.410424+00:00。输入准备、完整后验、probe配置构建均在计时外。

除首次建立的两个零正式场景外，各初态工作区有10,000正式记录、9,000正式关系、2候选；IR基线有1个owner资源。stage另含未选pending修改、可执行mode和staged删除；IR选择owner的完整资源树。精确argv和初态见[矩阵](validation/matrix.json)，全部进程及异常身份见[样本](validation/samples.jsonl)、[纠正记录](validation/corrections.json)。

## 正常成本与独立工作量

wall为三正常样本的中位（最小–最大）；CPU、RSS为三样本中位。CPU是wait4的user+system，可包含该口径计入的已等待后代。**RSS为Linux wait4/ru_maxrss的进程高水位，可能体现已等待子进程中的最大单进程值，不是同时整个进程树RSS之和或其峰值。**probe的资源成本单列在[完整聚合](validation/summary.json)，不混入本表。

正式读为成功完成的Node数据API调用次数／unique locator，不是物理磁盘I/O；同一ID的旧／新位置分别计locator。Git为完整cat-file blob出现次数／payload MiB，包含必要索引、所选对象及显式直接前序的必要历史对象，不将OID角色映射当调用阶段。

| 场景 | wall秒：中位（范围） | CPU秒 | RSS MiB | 正式读：次/locator | Git：对象/MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| DR new | 2.593（1.796–2.685） | 3.470 | 319.4 | 0/0 | 0/0.00 |
| DR publish-independent | 2.193（2.165–2.396） | 2.929 | 331.0 | 2/1 | 0/0.00 |
| DR publish-predecessor | 2.557（2.505–3.110） | 3.418 | 337.0 | 8/3 | 3/6.01 |
| DR discard-candidate | 1.823（1.772–4.774） | 2.489 | 300.3 | 0/0 | 0/0.00 |
| DR discard-formal | 2.092（2.021–2.323） | 2.783 | 336.6 | 4/1 | 0/0.00 |
| DR rename-formal | 2.927（2.864–3.190） | 3.784 | 342.5 | 12/3 | 2/6.01 |
| DR evolve-discard | 2.520（2.493–2.736） | 3.307 | 344.9 | 16/4 | 4/6.01 |
| DR stage-all | 3.278（3.239–3.518） | 4.383 | 411.1 | 2/1 | 11/42.08 |
| DR stage-domain | 2.339（2.327–2.409） | 3.321 | 359.2 | 2/1 | 11/42.08 |
| DR stage-index | 3.258（2.621–3.645） | 4.358 | 386.0 | 0/0 | 5/30.05 |
| DR bad-index（拒绝） | 0.286（0.257–0.670） | 0.444 | 204.4 | 0/0 | 0/0.00 |
| DR bootstrap（0正式） | 0.614（0.332–0.749） | 0.593 | 204.4 | 2/1 | 0/0.00 |
| IR new | 2.658（2.363–2.666） | 3.393 | 304.8 | 0/0 | 0/0.00 |
| IR publish-independent | 7.840（5.798–9.021） | 6.628 | 394.8 | 2/1 | 0/0.00 |
| IR publish-predecessor | 7.516（6.733–10.711） | 8.669 | 390.1 | 2/1 | 4/9.91 |
| IR discard-candidate-owner | 6.396（5.872–6.474） | 7.510 | 330.8 | 0/0 | 0/0.00 |
| IR discard-formal | 6.934（5.623–7.686） | 8.102 | 396.2 | 4/1 | 0/0.00 |
| IR rename-formal-owner | 4.904（4.817–5.439） | 5.583 | 331.5 | 12/3 | 0/0.00 |
| IR stage-all | 3.100（3.038–3.301） | 4.227 | 384.2 | 2/1 | 31/44.57 |
| IR stage-domain | 2.823（2.721–4.038） | 3.860 | 349.1 | 2/1 | 33/54.48 |
| IR stage-index | 2.324（2.285–2.371） | 3.151 | 359.6 | 0/0 | 5/24.76 |
| IR missing-index（拒绝） | 0.323（0.281–0.329） | 0.492 | 172.3 | 0/0 | 0/0.00 |
| IR bootstrap（0正式） | 0.326（0.313–0.328） | 0.470 | 172.3 | 2/1 | 0/0.00 |

正常样本最高wall为10.711秒，最高RSS为423.2 MiB；三个样本只说明本环境分布，不支持生产p95或统计显著性结论。

## 读取边界与真实效果

- 23个probe的无关正式正文、无关资源内容及无关／无法归属Git payload均为0；observer未知部分字节事件为0。两域new、stage index均不读正式正文；两域候选discard亦为0。直接依赖只用当前发布索引，不额外读其工作区正文。
- IR有前序publish只读新发布C的当前正式正文；必要历史证据是显式前序09999的379 B blob共2次及必要历史索引。初态H/P成员标签可重叠，不能说“各读一次”或推断调用阶段。新增OID以独立最终P的path/OID/size/SHA关联，不放宽到未选对象。
- 普通成功逐文件核对完整W字节／mode、完整索引投影及sourceRevision、资源；非stage的P与HEAD不变。publish保持候选ID；rename只改所选及正式引用者，保留未选候选字节；删除／evolve的实际增删与索引成员正确。
- 六个stage场景核对W完全不变、所选scope的精确payload／索引组合、完整范围外P的mode/OID/bytes/SHA与staged删除保持；IR domain/all处理完整所选owner树，包括未引用新增与HEAD旧成员删除。index不额外证明配套正文已同步。
- [10个对照](validation/controls.json)：两域未选正文损坏不阻断独立publish且不修复损坏；所选正式来源漂移明确拒绝并零写；legacy位置／跨日同名允许新建，默认完整ID位置正确；同日同名零覆盖拒绝；未选候选因rename留下的过期引用在其发布时失败且零写。IR候选容器保持flat `_candidate.<完整ID>`，发布为`<完整ID>.md`。

逐样本真实delta及判据见[效果](validation/effects.jsonl)，成功API次数／字节／路径及完整Git framing见[工作量](validation/workloads.jsonl)。

## 与旧基线可以比较什么

旧基线为[70c1a255全入口报告](../../docs/investigations/record-tools-entry-matrix-10k.md)。两轮版本、候选常数文本、部分初态和覆盖不同；**只比较明确对应的正式正文读取工作量，不给加速比**。

| 对应场景 | 旧 → 本轮正式读取次数 |
| --- | ---: |
| DR publish-independent | 10,002 → 2 |
| DR publish-predecessor | 10,012 → 8 |
| DR discard-candidate | 40,000 → 0 |
| DR discard-formal | 40,000 → 4 |
| DR evolve-discard | 40,004 → 16 |
| IR publish-independent | 2 → 2 |
| IR publish-predecessor | 7 → 2 |
| IR discard-candidate-owner | 50,000 → 0 |

DR发布／删除／演进与IR候选owner删除已从万级正式读取收敛到所选范围；IR无前序publish原本已是2次，本轮保持。IR有前序publish的Git对象出现次数20,000→4，但payload **7,480,190→10,387,382 B**：必要历史索引大于旧短正文集合，不能宣称总字节减少。stage仍有约25–54 MiB的完整索引及所选payload成本，不宣称所有总I/O或延迟降低。

rename的所选目标／引用者、stage的pending／owner初态与旧矩阵不同；缺索引由恢复改为拒绝，bootstrap为零正式。它们不套比率。逐项可比／不可比理由和旧资源SHA见[来源](validation/provenance.json)。

## 异常保留、复核边界与交接

原始观察保留了4项方法误判：IR flat locator、所选A的新archive位置、stage新写OID的最终P关联、IR显式前序的必要历史对象。这4项均绑定方法SHA，对同一进程、事件及字节未变的前后状态追加后验，**没有重跑或替换样本**。

另有1次IR stage-all因方法将正文标记追加到“随附资源”内而正确拒绝且零写；它不计入成功性能，修正三scope输入并追加1次有效运行。原准备证明覆盖投影／revision／资源引用，未证明全部正文节语法。一次非计时IR全量check准备命令被取消，不纳入样本或产品失败；小型重放recipe准备纠正也未改变实测输入。均见[完整纠正关联](validation/corrections.json)。

结论只覆盖本轮稀疏图、短正文、串行且输入准备预热缓存的样本；不覆盖冷缓存、并发／中断故障、十万条、大正文或全部命令矩阵，不从读量归因阶段耗时。索引JSON读写及内存处理仍有集合成本，不承诺O(1)。

紧凑材料共少量文件，无完整大清单／索引／依赖；[协议与重放](validation/protocol.md)、[方法与完整输出包](validation/replay-bundle.tar.gz)、[包内SHA清单](validation/replay-index.json)支持复核。输入recipe已重新生成20,007文件，逐字节／mode及两域Git HEAD与实测模板完全相同。大型raw仍在本轮自有临时目录，未清理历史基线；留存与可清范围由最终交接说明。
