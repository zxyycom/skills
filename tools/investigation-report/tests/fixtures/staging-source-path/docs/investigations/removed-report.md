---
title: "报告删除的基线"
id: "260828-removed"
formedAt: "2026-08-28T12:00:00+00:00"
question: "工作区删除报告后是否仍能从 HEAD 找到真实旧路径？"
tags:
  - "investigation-report"
relations: []
---

## 形成时背景
本报告在 Git 基线中已存在，文件名不等于完整 ID。

## 调查目的
验证只有基线索引保留该 ID 时的报告删除范围。

## 调查范围与依据
测试删除工作区文件并同步索引，再显式选择旧 ID 暂存。

## 调查结果与边界
删除必须应用于 removed-report.md，不得遗漏实际旧文件。
