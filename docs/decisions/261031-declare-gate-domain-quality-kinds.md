---
title: 显式声明 Gate 领域的质量验证类别
id: 261031-declare-gate-domain-quality-kinds
status: active
alignment: aligned
createdAt: 2026-10-31T08:15:49Z
purpose: 让领域质量检查由稳定责任类别选择，避免声明域空指标和磁盘状态改变验证义务。
background: 路径前缀只能识别维护代码候选，不能区分声明分发与实现责任，也不能用文件缺失推断不适用。
decision: 统一领域表显式区分代码、声明与材料；分别带入五项、三项或无通用代码质量检查。
tags:
  - project-tooling
  - responsibility-boundaries
  - validation-boundaries
  - vibe-gate
relations: []
---

## 目的

- 让显式领域选择依据稳定维护责任决定质量验证义务，而不是让路径偶然形状或当时磁盘状态决定检查是否启动。
- 保持实现、声明分发与非代码材料各自需要的证明，避免对声明域运行无实现材料的指标，也不把真正遗漏的代码静默变为不适用。

## 背景

- [统一领域声明](261031-unify-gate-domain-scope-declarations.md)已将领域自身 `files`、额外输入 `additionalInputs` 和完整输入投影分责，避免共享依赖扩散为局部指标范围。该判断继续拥有单一范围来源、每域独立排除后取并集，以及完整验收与局部验收的分工。
- `scripts/` 或 `tools/` 正 pattern 能定位指标候选，却不能表达领域是维护实现还是声明分发。Decision Records 与 Investigation Report 的分发域维护声明与生成边界，现有三个质量命令仍有证明责任，但不能据此要求无实现源码的指标扫描。
- 通过检查磁盘上是否存在代码来决定类别，会把删除、漏声明或漏扫描同时变成自动免检理由。类别与材料是否可取得必须分别建模。

## 决策

- 采用: 在既有 `gateToolScopes` 显式维护 `kind: code | declarations | material`，由领域 owner 按长期责任声明；不新增另一份范围表，不依据文件存在性或 pattern 前缀推断类别。该判断独立补充统一范围模型，原判断的输入闭包、投影来源和每域并集责任继续有效，不归档或重写它的形成时取舍。
- 采用: 显式 `code` 领域带入文件指标、函数指标和完整现有输入上的 `typecheck`、`lint`、`format:check`；`declarations` 只带入三个质量命令，不启动指标；`material` 只按其领域订阅和成功前置选择，不自动带入通用代码质量检查。当前两个记录工具的声明分发域属于 `declarations`，分发行为测试仍按自身真实代码责任单独声明。
- 采用: `code` 的维护代码投影仍从自身 `files` 的 `scripts/`、`tools/` JavaScript/TypeScript 候选形成；该路径规则仅用于代码类别内部的投影。代码类别未声明相应正 pattern 时构造失败，已选材料意外为空时继续严格阻断；不以磁盘扫描结果改判类别、跳过或通过。
- 采用: 自身源码和测试进入领域 `files`，额外共享依赖继续进入真实输入闭包。版本管理领域明确拥有共享版本管理源码及其测试，不能把自己的源码仅当额外依赖，也不能通过删除共同依赖来缩小扫描。其他领域不会因读取该共享输入而自动成为版本管理指标域。
- 采用: 保留公开能力 ID、Check ID、catalog、阈值、blocking、基础环境与成功前置；重复检测保持独立 `repository-code` 订阅及完整比较。类别只细化 selected 的通用质量选择，quick、changed、full、CI、release 与 receipt 的责任继续按既有 owner 执行。当前接入与验收由[领域声明契约](../gate-check-authoring.md#领域范围与检查订阅)承接。
