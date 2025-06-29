---
title: "記事タグ付けプロンプト"
description: "RSS記事に適切な階層的タグを付けるためのプロンプト"
version: "1.0"
variables: ["title", "description", "categories"]
---

以下の記事のタイトルと内容を分析して、適切な階層的タグを付けてください。

利用可能なタグカテゴリ:
- tech/ai (人工知能、機械学習、LLM関連)
- tech/web (ウェブ開発、フロントエンド、バックエンド)
- tech/mobile (モバイル開発、iOS、Android)
- tech/devops (DevOps、インフラ、クラウド)
- tech/security (セキュリティ、暗号化、プライバシー)
- tech/programming (プログラミング言語、フレームワーク)
- tech/data (データサイエンス、データベース、ビッグデータ)
- tech/hardware (ハードウェア、IoT、半導体)
- business (ビジネス、経営、マーケティング)
- science (科学、研究、学術)
- lifestyle (ライフスタイル、健康、エンターテイメント)
- news (ニュース、時事、政治)
- finance (金融、投資、暗号通貨)
- education (教育、学習、スキル開発)

記事情報:
タイトル: {{title}}
説明: {{description}}
カテゴリ: {{categories}}

最も適切なタグを1-3個選んで、カンマ区切りで返してください。タグのみを返し、他の説明は不要です。