---
title: "未选报告的保留基线"
id: "260828-unrelated"
formedAt: "2026-08-28T12:00:00+00:00"
question: "文件名与另一报告 ID 相同时能否保持暂存隔离？"
tags:
  - "investigation-report"
relations: []
---

## 形成时背景
本报告的文件名与所选报告的完整 ID 相同，但 frontmatter 声明另一身份。

## 调查目的
验证文件名不会把未选报告纳入其他 ID 的暂存范围。

## 调查范围与依据
测试分别改写本报告的 pending 版本和工作区版本，建立可区分的内容。

## 调查结果与边界
暂存其他报告时应保留本报告已经存在的 pending 字节。
