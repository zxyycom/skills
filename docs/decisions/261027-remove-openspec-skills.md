---
title: 停止维护和分发 OpenSpec 四阶段 skills
id: 261027-remove-openspec-skills
status: active
alignment: aligned
createdAt: 2026-10-27T03:17:58Z
purpose: 让已确认退出的 OpenSpec 能力离开当前维护与分发集合，并保留其历史可回放性。
background: 四阶段能力曾共同分发并进入去留观察期；使用者现明确选择整组删除，继续保留入口或活动专属决策会混淆当前范围。
decision: 删除四个技能包与当前入口，归档专属决策；历史认识、独立 Change Plan 和用户已有安装保持各自边界。
tags:
  - openspec
  - project-documentation
  - skill-maintainer
relations:
  - type: 替代
    target: defer-openspec-maintenance-during-removal-review
    summary: 结束去留观察，按明确授权退出仓库维护与分发
  - type: 替代
    target: distribute-openspec-as-an-aggregate-unit
    summary: 移除聚合单元及四个成员的当前分发
  - type: 替代
    target: gate-change-implementation-by-review
    summary: 退出四阶段能力，停止维护其专属实施门禁
  - type: 替代
    target: prefer-cli-for-change-state-and-artifact-routing
    summary: 退出四阶段能力，停止维护其专属CLI路由
---

## 目的

- 让当前维护与分发集合准确反映已选择保留的能力，不再把退出能力作为可用入口或待恢复的维护任务。
- 保留退出前的判断与调查依据，使后续能够回放采用和退出的边界。

## 背景

- 四个 OpenSpec skill 曾按探索、提案、实施与归档协作，并作为聚合分发单元维护；随后进入去留观察期，普通改进默认延期。
- 使用者现已明确选择删除整组 skills 及配套入口，继续保留观察状态或专属活动决策不再反映当前方向。
- 主仓库按实际 skill 目录发现和构建分发集合；仅删除首页链接而保留技能目录，不能使这些能力退出后续制品输入。

## 决策

- 采用: 删除 `skills/openspec-explore/`、`skills/openspec-propose/`、`skills/openspec-apply-change/` 和 `skills/openspec-archive-change/`，同步移除当前概览、人类介绍和将其视为现存单元的示例。
- 采用: 沿用基于现存目录的发现与分发机制，不为已删除成员另建黑名单或占位包。
- 采用: 四阶段能力退出后，其观察期、聚合分发、实施门禁和 CLI 路由专属决策退出活动依据；其他 skills 的通用授权、规划与提交分类规则继续独立适用。
- 采用: 保留历史决策、调查报告和已形成的任务结果，不把过去采用过的事实改写为从未存在；历史证据指向已移除源文件时使用可回查的固定版本引用。
- 采用: 退出范围限于本仓库维护源与后续制品输入，不卸载用户已有安装，不删除外部 OpenSpec CLI、项目 artifacts 或远端既有制品；正式发布继续服从原发布门禁与授权。
