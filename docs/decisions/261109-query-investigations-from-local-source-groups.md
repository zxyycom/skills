---
title: 按本地来源组逐源查询调查报告
id: 261109-query-investigations-from-local-source-groups
status: active
alignment: aligned
createdAt: 2026-11-09T09:07:35Z
purpose: 以少量配置复用单集合查询，支持跨仓库发现调查报告。
background: 经常需要跨仓库检索，但全局索引与合并语义会增加不必要的维护成本。
decision: 从调用目录本地配置选择来源组，逐源执行并保留原结果，不建立全局查询语义。
tags:
  - investigation-report
  - query-composition
relations: []
---

## 目的

- 让使用 `skills/investigation-report/` 的调用者一次恢复多个调查集合中的已有认识，同时继续使用单集合查询的来源、筛选和预算契约。
- 将本机来源与默认查询组归于调用工作区，避免共享 skill 安装使同机多个项目互相影响。

## 背景

- 调查报告经常分布在不同仓库与不同目录；仅配置仓库根不能准确表达真实来源。
- 当前原生查询已经支持独立的工作区根与调查目录，复用单源查询即可完成用户需要的重复调用与结果拼接。
- `.local/` 用于集中忽略本机文件；来源配置不属于 skill 制品，也不要求随工具安装或更新。

## 决策

- 采用: 为 Investigation Report 的 `list` 与 `search` 增加“配置 → key → 有序来源数组”的薄编排，逐源复用现有查询并分组保留原结果。筛选、limit、offset、预算、顺序和覆盖继续属于每次单源调用，不建立全局排序、去重、分页或覆盖汇总；这样可直接复用已有查询契约。
- 采用: 来源配置归于调用工作区，默认读取调用时当前目录下的 `.local/.investigation-report.local.json`，不随 `--root` 改变、不向上查找；显式 `--config` 可选择其他文件。配置不属于受管分发输入，查询也不创建或写回它，以保持本机项目选择与共享 skill 安装分离。
- 采用: 以 `sources` 将 key 映射为来源数组，以 `defaultKey` 提供默认组；每源明确声明 `root` 与 `investigationsDir`。相对 root 以配置文件所在目录为基准，调查目录相对该源 root，使不同仓库的自定义调查目录都能被准确定位。
- 采用: 保留原单源入口和无默认配置时的原行为；显式请求缺失配置、未知 key 或已有非法配置时明确失败。显式单源定位与配置选择互斥，使调用者能够确定实际使用了哪种来源选择。
- 采用: 来源失败后继续读取其他源，并如实交付整体失败及各源结果；命中报告仍按所属来源定位，通过原有 `show` 回读。配置只编排正式报告发现，不扩展到写操作或候选维护。

配置选择、参数冲突、逐源结果和回读的现行操作契约由 [Investigation Report CLI](../../skills/investigation-report/references/cli-operations.md#多来源配置)承接。
