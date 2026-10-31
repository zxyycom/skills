---
title: 保留原生文件保护并仅豁免构建适配源码
id: 261031-preserve-native-file-guards-with-build-source-exception
status: active
alignment: aligned
createdAt: 2026-10-31T08:15:50Z
purpose: 让全部原生维护材料覆盖真实构建适配源码，同时继续隔离依赖、生成物与运行产物。
background: 上游固定排除全部 build 路径，误将本仓库 scripts/build 源码排除；全局关闭又会扩大到产物。
decision: 以统一项目文件政策显式重建完整上游排除，仅豁免 scripts/build 的真实维护源码目录。
tags:
  - project-tooling
  - source-artifact-separation
  - validation-boundaries
  - vibe-gate
relations: []
---

## 目的

- 让真实维护的构建适配源码与相邻维护材料持续进入适用原生检查，而不是因为目录名等同通用产物目录被静默排除。
- 在恢复源码覆盖的同时，保留依赖、生成物、缓存和运行产物的完整隔离边界，避免局部补洞变成全仓扩大扫描。

## 背景

- [源码 owner 判断](assign-tool-and-automation-source-owners.md)已将 `scripts/build/` 定义为主仓库生成适配源码，而非构建输出。上游原生文件收集固定排除 `**/build/**`，后置正 pattern 不能覆盖该默认层；因此项目的真实源码会被合法的通用默认排除遗漏。
- 只关闭默认排除会让依赖和运行产物重新成为候选；只对指标设置例外，又会让同一路径里的密钥、JSON 或 Markdown 材料继续漏扫。覆盖问题属于共同文件选择边界，而非单个指标规则。
- [统一领域声明](261031-unify-gate-domain-scope-declarations.md)继续约束局部代码投影来源与额外依赖分责；它不拥有上游扫描防呆层。本判断单独决定项目文件政策，不改变领域输入闭包或质量阈值。

## 决策

- 采用: 为全部原生维护材料 selection 统一应用项目文件政策。显式设置 `useDefaultExcludes: false`，以当前上游 `DEFAULT_PROJECT_FILE_EXCLUDES` 为完整基线重建项目排除，只替换全局 build 排除来豁免根 `scripts/build/` 维护目录；不把关闭开关本身视为可以放弃保护的授权。
- 采用: build 例外只覆盖根 `scripts/build/`，材料仍满足各 Check 的后缀、角色和业务排除。根 `build/`、其他根下的嵌套 build、`scripts/` 其他子目录中的 build，以及 `scripts/build/` 内再嵌套的 build 均继续排除。依赖、VCS/产品状态、日志、缓存、临时目录、虚拟环境、dist、generated 和 generated 文件等全部上游保护继续生效，进入豁免目录也不能绕过。
- 采用: 重复、代码指标、密钥、JSON、Schema、Markdown 链接与 Markdown 内容的维护材料共用这一政策；changed 的 Markdown 输入指纹也必须从同一来源取得，不能另建仍保留全局 build 排除的材料视图。各 Check 的原生 eligibility、内容安全、调查资源/作者工作台及其他领域排除保持自身 owner。
- 采用: selected 代码投影保留原 selection 的 `useDefaultExcludes` 与完整项目排除，不能仅复制 patterns 使上游默认层再次隐藏构建适配源码。changed、full、CI 与 release 的完整维护代码同样覆盖该真实源码；不能用局部通过替代完整模式覆盖证明。
- 采用: 依赖升级或项目文件适配变化时，对照完整上游默认集合验收豁免内真实材料、豁免内外产物及嵌套 build 边界；保留既有 Check ID、catalog、阈值和 blocking。该判断与统一领域声明、显式质量类别、历史调查材料边界独立共存，当前精确政策由[原生材料 owner](../gate-policy.md#原生材料范围与质量政策)承接。
