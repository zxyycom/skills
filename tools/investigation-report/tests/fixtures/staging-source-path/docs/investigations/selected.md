---
title: "所选报告的修改基线"
id: "260828-selected"
formedAt: "2026-08-28T12:00:00+00:00"
question: "暂存是否使用所选报告的索引位置？"
tags:
  - "investigation-report"
relations: []
---

## 形成时背景
所选报告保存于语义文件名，另一个报告占用完整 ID 对应的文件名。

## 调查目的
区分按 sourcePath 定位和根据 ID 推导文件名的行为。

## 调查范围与依据
此文件与相邻报告共同构成暂存路径测试的固定 Git 基线。

## 调查结果与边界
所选报告的更新应进入 selected.md，不能覆盖另一报告的 pending 内容。
