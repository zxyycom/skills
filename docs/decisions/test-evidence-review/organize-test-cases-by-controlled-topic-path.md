---
title: 按受控主题路径维护单文件测试证据
status: archived
alignment: null
createdAt: 2026-07-26T15:20:07Z
purpose: 让测试 case 的稳定身份、责任归属和物理源路径在账本增长时仍可独立校验和查询。
background: 根目录直属主题文件只能表达隐含分组，无法约束主题集合、路径唯一归属或单 case 写入边界。
decision: 由受控主题表定义责任域，每个 case 独占一个主题路径文件，并由统一索引投影主题 metadata 和路径派生查询 key。
relations:
  - type: 修订
    target: test-evidence-review/organize-native-test-cases-by-responsibility-topic.md
---

## 目的
- 保持一个最小原生测试入口对应一个全局唯一 case，不让目录组织反向改变测试粒度。
- 让每个 case 的测试责任归属由受控 topic 与唯一物理路径共同表达和机械校验。
- 让 topic 定义、跨 topic 查询和定点展开共享一个可重建的统一索引，而不增加另一份手写状态。

## 背景
- 根目录直属主题 Markdown 可以减少单文件写入热点，但主题集合只隐含在文件名中，无法稳定描述边界或表达已定义但暂时没有 case 的责任域。
- 一个主题文件承接多个 case 时，局部变更仍共享写入边界，也无法从源路径直接确认一个文件对应哪个独立 case。
- case ID 是跨目录稳定身份；topic 是责任归属和查询维度。二者需要独立表达，移动责任归属不应重写 case ID。
- 通用索引已经支持 typed metadata、领域 key、源路径和 revision，测试证据领域无需复制主题状态或修改共享协议。

## 决策
- 采用: 一个保留的最小原生测试入口仍恰好对应一个 case，case ID 在全部 topic 中全局唯一；topic 只组织责任边界，不合并、拆分或重新定义测试入口。
- 采用: 测试证据根目录用严格的受控主题表定义全部 topic；定义可以暂时没有 case，但已经存在的 topic 目录必须非空，未知 topic 和未声明根成员无效。
- 采用: 每个 case 独占 `<topic>/<slug>.md`，`sourcePath` 使用测试证据根目录相对路径；路径第一段是唯一 topic 归属，移动文件不修改 case ID。
- 采用: topic 表、case 文件和配置共同组成权威输入；派生索引在 metadata 中投影完整 topic 定义，并从 `sourcePath` 派生精确 topic key，不在 state 中维护第二份 topic 字段。
- 采用: revision 覆盖规范化 topic 定义、case ID 规则以及全部相对源路径和正文；目录位置、说明文件、索引产物、纯 JSON 格式和换行风格不改变语义 revision。
- 采用: `topics`、topic 过滤、严格检查、同步和索引失效回退都读取同一合法目录模型；工具不扫描测试源码、不执行 Entry，也不自动收集、注册、迁移或兼容双读旧目录。
- 不采用: 继续用根目录直属主题 Markdown 隐式定义 topic、在一个主题文件聚合多个 case、从 case ID 或正文猜测 topic，或为了渐进发布长期保留 v1/v2 双轨读取。
