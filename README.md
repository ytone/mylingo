# mylingo

TOEFL Writing / Speakingで頻出するcollocationと前置詞表現を、10問ずつ反復学習する個人用Webアプリです。バックエンドや認証は使わず、学習履歴はブラウザの`localStorage`に保存します。

## ローカル起動

Node.js 20以降を用意し、次を実行します。

```bash
npm install
npm run dev
```

ターミナルに表示されるURL（通常は `http://localhost:5173/mylingo/`）を開きます。

## Build

```bash
npm run build
npm run preview
```

成果物は`dist/`に生成されます。Viteの`base`はリポジトリ名に合わせて`/mylingo/`です。

## GitHub Pagesへの公開

1. このプロジェクトをGitHubの`mylingo`リポジトリへpushします。
2. リポジトリの **Settings → Pages → Build and deployment** で、Sourceを **GitHub Actions** にします。
3. `main`ブランチへpushすると、`.github/workflows/deploy.yml`がBuildと公開を行います。

通常の公開URLは `https://<GitHubユーザー名>.github.io/mylingo/` です。

## ファイル構成

```text
src/
  data/collocations.json  # 100問の問題データ
  App.tsx                 # 画面とクイズ進行
  lib.ts                  # 定着度・出題・日付などのロジック
  storage.ts              # localStorage、Import / Export
  styles.css              # モバイルファーストのUI
  types.ts                # TypeScriptの型と表示ラベル
.github/workflows/deploy.yml
vite.config.ts
```

## 問題データの追加・編集

`src/data/collocations.json`を編集します。既存の履歴と衝突しない、一意で変更しない`id`を各問題に付けてください。101問目を追加する場合の例です。

```json
{
  "id": 101,
  "category": "verb_preposition",
  "collocation": "depend on",
  "question": "The outcome depends ___ several factors.",
  "answer": "on",
  "distractors": ["of", "from", "NONE"],
  "meaning": "〜次第である",
  "example": "The outcome depends on several factors."
}
```

`answer`と3つの`distractors`で、重複のない4択にします。前置詞なしは`NONE`と記述します（画面では「前置詞なし」と表示されます）。利用可能なcategoryは次の7つです。

- `adjective_preposition`
- `verb_preposition`
- `noun_preposition`
- `no_preposition`
- `contrast`
- `email`
- `speaking`

## localStorage schema

キーはすべて`mylingo`で始まります。

- `mylingo.version`: schema version（現在は`1`）
- `mylingo.progress`: question IDごとの回答回数、正解・不正解、連続正解、正解した日、最終回答、定着度、誤答選択肢
- `mylingo.dailyHistory`: ローカル日付ごとの完了セット数、回答・正解数、Best、Perfect回数

問題履歴は配列の位置ではなくquestion IDをキーにするため、問題を追加しても既存履歴は維持されます。

## masteryScore

`src/lib.ts`の`calculateMastery`で0〜100点を計算します。

- 累積正答率: 最大30点
- 正解した異なる日数: 1日10点、最大50点
- 現在の連続正解: 1回5点、最大15点
- 直近の正解: 最大5点
- 累積誤答と14日を超える未回答期間: 減点

異なる5日での正解を最も強く評価するため、同じ日に繰り返すだけでは100点になりません。表示レベルは未学習、要復習（0〜39）、学習中（40〜59）、ほぼ定着（60〜79）、定着（80〜100）です。

## 通常学習の出題ロジック

問題ごとに、直近の誤答、低いmastery、低い正答率、最終回答からの経過日数を使って優先度を付けます。目安として苦手・要復習から5問、学習中から3問、未学習や定着済みを含むその他から2問を選びます。不足時は優先度順で補い、同一セットで重複しません。

## Streak

- Learning Streak: その日に通常セットを1回以上完了すると継続
- Perfect Streak: その日に10問セットで10/10を1回以上達成すると継続

今日が未学習の場合は昨日までの連続日数を表示します。学習してPerfectが出なかった日はLearningのみ継続し、Perfectは途切れます。今日と最長の値は日ごとの履歴から毎回再計算します。

## Export / Import

設定画面の「JSONを保存」で全履歴をバックアップできます。「JSONを選択」でversionと主要フィールドを検証して復元します。端末間の自動同期はないため、別端末へ移す場合もExport / Importを使用してください。
