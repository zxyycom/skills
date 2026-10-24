# Design

以已发布索引作为未选部分的明确事实边界，让来源读取随实际依赖增长。

## Context

共同操作同步入口目前接收领域完整来源快照，再准备 baseline、解析 selector、原生 build/fresh/publish。IR rename 在锁前与锁内重复 prepare；publish/discard 已直接锁内准备，需要按实际调用核对而非统一删除。

## Goals / Non-Goals

目标是局部 selected 和无重复预演的正式入口，以及实测的小读取方案。不改变持久格式、stage、其他 skill、事务提交点、写集、权限与恢复；不引入 daemon、数据库、跨调用 cache 或插件框架。

## Decisions

### Intended Change

已确认：selected 从合法 canonical baseline 定位选中对象；读取选中及必要依赖，组合完整投影并验完整关系。定义的局部 readRevision 重读本次真实来源，以 baseline 承接其余 revision，原生 selected 仍负责 canonical、集合 metadata、选择接纳、fresh 与发布。缺/坏索引要求 full sync；已知路径缺失可作所选删除；已知路径改 ID 必须 old/new 同选且身份唯一；未知新 selector 无已读 locator 证明时拒绝并要求 full sync；未知位置移动不被发现，已知旧路径缺失按删除处理，需 full sync 重新发现移动。不要把无法检测的移动声明为自动拒绝；不猜 basename 或扫描 header。

IR 显式 preflight 继续锁外完整准备；正式 rename 删除隐式锁外 prepare，保留目录规范化和锁内完整 prepare、fresh、写后与恢复。逐入口核对其他操作。

读取策略已按隔离同保证实验选择：单阶段路径数 >=1000 时使用一个独立 worker 串行同步读取，小批仍用原 async。1000 是已观察的最小有益规模，并非最优交叉点；64路径/约8MiB分块用于背压，不构成单正文限制或精确RSS保证。队列仅执行领域已选路径与阶段，有序交回结果，返回前回收，不承接写入/恢复。正常worker保留Node原生参数继承；permission模型或实际--input-type受约束调用预先走当前进程async，不启动worker、不失败重试，不承诺该分支加速。

### Resulting Impacts

两域公开 selected 新鲜度范围变窄，需同步 CLI/固定领域契约、回归与长期决策。独立版本与生成闭包同步。未知身份/新引用不读即不声称发现。

## Risks / Trade-offs

基线中未选事实可能不是当前正文；这属于明确 scope 而非全量健康结论。相关未选依赖仍须 current。未知路径新增/移动需要明确 full sync 恢复路径。锁忙可以先于深层领域错误。性能测试期间不并发 Gate 或聚合测试。

## Open Questions

无范围/选型开放问题；实现、独立验证和稳定产品完整Gate已通过，本轮有限端到端证据已完成，等待文档/测试预算收尾后的最终验收，不外推未测规模或收益。

## Checkpoint

根审计已选择 baseline-only 定位：缺/坏索引要求 full sync；已知路径缺失仅作所选删除，完整组合图继续闭合。已知路径内改 ID 必须 old/new 都显式选择且新身份在合法发布投影及本次已读范围内唯一可证明；未知新 selector 无已读 locator 证明时拒绝；未知移动不被发现，旧路径缺失按删除处理，需要 full sync 重新发现。当前采集范围显式返回 checkedIds/currentness，未选来源沿用发布事实。

实现采用 DR/IR 专属局部同步 coordinator；使用现有安全 snapshot reader，独立 fresh 对现存来源重新读取并比较 bytes/identity/mode/父链；缺失路径两次独立证明 canonical namespace 内安全缺失，不保证缺失父目录跨阶段同一性；另保护 baseline 实际 bytes。领域分别提供解析、revision、必要依赖、完整图与直接资源验证，原生 selected 保留 canonical/metadata/selected 接纳/fresh/发布/readback。通用 Index Runtime 与 stage 不变。


## Implementation Observations

- 根补审确认 IR 删除/已读同路径改 ID 的旧 owner 是已知受影响位置：准备与独立 fresh 均证明旧 owner 路径缺失，空树、不安全类型、大小写变体也拒绝；不代删资源、不遍历其他 owner。full sync 不是清除孤立树命令。
- reader 实验选择 >=1000 路径时阶段内单 worker 串行同步读取（已观察最小有益规模，不是最优交叉点）；小批沿用原 async。背压分块不限制单正文、不将写入/恢复下放，具体底层由独立实现代理负责。
