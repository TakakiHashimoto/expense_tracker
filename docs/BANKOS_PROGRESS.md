# BankOS Development Progress

最終監査日: **2026-11-24（America/Vancouver）**

監査対象: `feat/subscription-detection` / `e640ffe` ＋既存の未コミットP05-RECENCY変更

この文書は実装・検証・未解決事項を区別して管理する進捗の基準資料です。完了判定は項目ごとの範囲に限定し、実装やユニットテストの存在だけで本番運用可能とは判断しません。

## 1. Project Overview

BankOSはNext.js App Router、React、TypeScript、Tailwind CSS、Supabase Auth/PostgreSQL、Plaidを使う個人向け家計管理アプリです。認証、銀行口座接続、取引同期、取引一覧、ダッシュボード、予算管理、定期支払い検出の実装があります。PlaidはSandbox中心の検証段階です。

今回の監査はリポジトリの読み取りとネットワークを遮断した既存テストの実行に限定しました。今回の変更は本ファイルと`SUBSCRIPTION_RECENCY.md`の状態参照文のみです。開始時から存在する実装・テストの未コミット変更は維持しました。DBへの接続・データ変更、マイグレーション適用、環境ファイル変更、デプロイ、コミット、pushは実施していません。

**Detected Recurring Payment != Confirmed Active Subscription**

検出対象は過去の取引に見られる月次パターンです。現在有効な契約、確定した次回請求、解約可能性を保証しません。画面の予測日は選択された支払いパターンに基づく推定です。`confidence: 0.7`は固定のヒューリスティック値で、統計的な確率ではありません。

証拠を次のように区別します。

- **今回実行**: この監査で実行して結果を確認したコマンド。
- **コード確認**: 現在のソース、SQL、テスト定義から確認した実装。実環境での動作確認とは別。
- **過去報告**: 依頼文、過去の会話、既存ドキュメントによる報告。今回の独立した再検証はない。
- **未検証**: 現在の環境・commitに結びつく十分な実行証拠がない。

状態: `DONE`＝記載範囲の実装・検証が完了、`IN PROGRESS`＝一部実装済みで残件あり、`TODO`＝対応が必要、`BLOCKED`＝具体的な前提不足で進められない、`UNVERIFIED`＝主張または環境状態を未検証。優先度はP0＝現在の検証ゲートを破る回帰、P1＝認可・整合性・主要検証、P2＝品質・性能、P3＝将来計画です。

## 2. Current Development Snapshot

| 項目                | 今回確認した状態                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Branch / HEAD       | `feat/subscription-detection` / `e640ffe`                                                                                      |
| 検証対象            | HEADに加え、作業ツリー上のP05-RECENCY実装・3テストファイル・仕様文書。292件成功はHEAD単独の結果ではない                        |
| 開始時working tree  | tracked 4ファイル変更＋untracked 5ファイル。既存変更を保持                                                                     |
| 今回の変更          | `docs/BANKOS_PROGRESS.md`更新と、既存untracked `docs/SUBSCRIPTION_RECENCY.md`の状態参照文1箇所。アプリ・テストは変更していない |
| 個別タスク          | P01-LOG、P05-TRIPLE、P05-MULTI、P05-RECENCYを限定された実装・ローカル検証範囲でDONE                                            |
| Phase 5             | **IN PROGRESS**。DB、authentication/RLS、browser/HTTP E2Eは未完了                                                              |
| Subscriptionテスト  | **12ファイル、172件成功**（全体実行の結果を集計）                                                                              |
| 全体Vitest          | **18ファイル、292件成功、失敗0**                                                                                               |
| TypeScript / ESLint | `npx tsc --noEmit`成功。lintは0 errors / 5 existing warnings                                                                   |
| Release             | このworking treeの本番リリース・デプロイ状態は`UNVERIFIED`。commit/push/deployは未実施                                         |

開始時から存在する変更:

```text
M  src/features/subscriptions/components/SubscriptionDashboard.tsx
M  src/features/subscriptions/domain/detectSubscriptions.ts
M  src/features/subscriptions/domain/types.ts
M  src/features/subscriptions/server/getDetectedSubscriptions.ts
?? docs/SUBSCRIPTION_RECENCY.md
?? src/features/subscriptions/__tests__/SubscriptionRecencyDisplay.test.ts
?? src/features/subscriptions/__tests__/evaluateSubscriptionRecency.test.ts
?? src/features/subscriptions/__tests__/subscriptionRecency.integration.test.ts
?? src/features/subscriptions/domain/evaluateSubscriptionRecency.ts
```

直近8件のcommit（2026-11-24確認）:

```text
e640ffe feat(subscriptions): implement findRecurringTriples function and update detectSubscriptions logic
5568495 Refactor error handling and logging for Plaid sync operations
ac0cece feat(subscriptions): add subscription loading and error components, enhance dashboard with detected subscriptions
a42f8dc feat(subscriptions): implement subscription detection and conversion logic
88d0821 feat(subscriptions): add subscription detection and related tests
19ad6c9 feat(plaid): implement atomic sync RPC and integration tests
a13f08f fix(db): reproduce sync leases and monthly summary RPC
bbdddb6 feat(plaid): implement error logging and webhook verification improvements
```

11月22日の`ac0cece`監査では203/204件成功、後続検証では209/209件成功と記録されていました。これらは履歴としてChange Logへ統合し、現在値は上表を基準にします。P01-LOG修正は`5568495`、複数候補検出は`e640ffe`、recencyは未コミットの作業ツリー上にあります。

## 3. Master Roadmap

Phaseの番号・順序・名称は従来のロードマップを維持しています。「従来報告」は履歴であり、今回の検証結果とは別です。

| Phase | Description              | 従来報告                                              | 現在の監査状態 | 判定根拠 / 残件                                                                                               |
| ----- | ------------------------ | ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 0     | Architecture Audit       | Complete                                              | UNVERIFIED     | 既存の構成資料はあるが古い記述を含む。Phase全体の完了条件・承認記録は未確認。`P00-AUDIT`                      |
| 1     | Security Baseline        | Complete                                              | IN PROGRESS    | P01-LOG回帰は解消し既存security系120件が成功。現commitのsecurity build・dependency再検証はP01-RECHECKで未完了 |
| 2     | Database Reproducibility | Local/Hosted migrations verified                      | UNVERIFIED     | 3本のmigrationは存在。Local/Hostedへの適用結果・現時点の差分は今回未検証。`P02-REPRO`                         |
| 3.1   | Atomic Plaid Sync        | Main integration tests passed                         | UNVERIFIED     | atomic RPCと11項目のSQLテストは実装済み。今回SQLは未実行。口座更新はRPCの対象外。`P31-VERIFY`                 |
| 3.2   | Sync Hardening           | Incomplete                                            | IN PROGRESS    | leaseやWebhook検証は一部実装済み。下記13項目を継続管理                                                        |
| 4     | Financial Correctness    | Not started                                           | TODO           | Subscription内のminor-unit対応はあるが、アプリ全体の通貨・pending・丸め・期間の整合性検証は未完了。`P04-FIN`  |
| 5     | Subscription Detection   | Domain, Adapter and UI implemented; Hardening pending | IN PROGRESS    | 172件成功。TRIPLE/MULTI/RECENCYの限定実装はDONE。DB・authentication/RLS・browser E2Eとその他hardeningは未完了 |
| 6     | AI Insights              | Future                                                | TODO           | 対応する実装・評価証拠は今回の検索で確認できず。`P06-AI`                                                      |
| 7     | Production Readiness     | Future                                                | TODO           | リリースゲート未充足。Subscriptionはdevelopment限定。`P07-RELEASE`                                            |
| 8     | AWS / Terraform          | Future                                                | TODO           | Terraform構成を確認できず。`P08-INFRA`                                                                        |
| 9     | CI/CD                    | Future                                                | TODO           | `.github`ディレクトリなし。外部サービス上の自動化は未確認。`P09-CI`                                           |
| 10    | Observability            | Future                                                | TODO           | ログ実装はあるが監視・アラート・SLOの運用証拠なし。`P10-OBS`                                                  |
| 11    | Incident Response        | Future                                                | TODO           | インシデント対応・復旧訓練の資料を確認できず。`P11-IR`                                                        |

## 4. Completed Work and Evidence

以下の`DONE`は限定された実装・テストの範囲です。Phase全体の完了やHosted環境への適用を意味しません。

| 項目                        | 状態 | 確認した実装・証拠                                                                                                                                                                                                                                                                                                                                               | 検証の限界                                                                                                       |
| --------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 認証・保護ルートの構造      | DONE | [Protected layout](<../src/app/(protected)/layout.tsx>)、[Supabase server client](../src/lib/supabase/server.ts)、[認証redirectテスト](../tests/auth-redirect.test.ts)                                                                                                                                                                                           | 実セッション・Hosted RLSのE2Eではない                                                                            |
| セキュリティ基盤の導入      | DONE | [security-baseline.md](security-baseline.md)、server-only、allowlist型logger、各Plaid routeのerror boundary                                                                                                                                                                                                                                                      | P01-LOG回帰は解消し全体テスト成功。実運用・dependency/security buildの再検証はP01-RECHECKで別管理                |
| DB定義のリポジトリ管理      | DONE | [基礎schema/RLS](../supabase/migrations/20260903011843_remote_schema.sql)、[lease・月次summary](../supabase/migrations/20261112000000_add_sync_lease_and_monthly_summary.sql)、[atomic commit](../supabase/migrations/20261113130431_plaid_sync_atomic_commit.sql)                                                                                               | ファイルの存在・内容を確認。現DBへの反映は未検証                                                                 |
| Atomic transaction sync実装 | DONE | [db.ts](../src/features/plaid/server/db.ts)がservice-role clientから`commit_plaid_sync`を呼ぶ。SQLは取引・カテゴリ・cursorを同一RPC内で更新                                                                                                                                                                                                                      | account snapshot、failure記録、lease取得・解放は別操作                                                           |
| SQL統合テスト定義           | DONE | [atomic_sync_integration.sql](../supabase/tests/atomic_sync_integration.sql)に11項目                                                                                                                                                                                                                                                                             | 成功メッセージのSQL定義は実行ログではない。今回未実行                                                            |
| Subscription Domain         | DONE | [detectSubscriptions](../src/features/subscriptions/domain/detectSubscriptions.ts)、[findRecurringTriple](../src/features/subscriptions/domain/findRecurringTriple.ts)、[findRecurringTriples](../src/features/subscriptions/domain/findRecurringTriples.ts)、[evaluateSubscriptionRecency](../src/features/subscriptions/domain/evaluateSubscriptionRecency.ts) | TRIPLE/MULTI/RECENCYの限定された決定規則を検証。契約活動判定・誤検知率・すべての入力に対する最適分割は保証しない |
| Subscription Adapter        | DONE | [取得処理](../src/features/subscriptions/server/getSubscriptionTransactions.ts)、[変換処理](../src/features/subscriptions/server/toTransactionInput.ts)、[orchestration](../src/features/subscriptions/server/getDetectedSubscriptions.ts)                                                                                                                       | orchestrationテストはDB取得をmock。実PostgREST pagination/RLSを検証していない                                    |
| Subscription UI             | DONE | [Dashboard](../src/features/subscriptions/components/SubscriptionDashboard.tsx)、[formatting](../src/features/subscriptions/components/formatSubscription.ts)、[loading](<../src/app/(protected)/subscription/loading.tsx>)、[error](<../src/app/(protected)/subscription/error.tsx>)                                                                            | HTMLテストはCSSレイアウト、hydration、実サービスを含まない                                                       |
| Subscription自動テスト      | DONE | [tests](../src/features/subscriptions/__tests__)の12ファイル172件が今回成功。既存検出・adapter・SSR/formatting 95件＋recency 77件                                                                                                                                                                                                                                | Recencyはdomain 64件＋mocked server/detection 6件＋SSR 7件。実DB・認証・browser E2Eではない                      |

Atomic RPCのコードにはItem行の`FOR UPDATE`、所有者、lease token・期限、expected cursor、revoked状態の検査があります。`SECURITY INVOKER`で、実行権限は`PUBLIC`・`anon`・`authenticated`からrevokeし`service_role`に付与する定義です。このRPCの保護と、認証済みユーザーによるテーブル直接更新権限は別問題です。

SQLテストの11項目は、通常commit、manual category保持、replayの重複防止、soft delete、再有効化、途中失敗rollback、誤token、期限切れtoken、stale worker、cursor不一致、revoked Itemです。同一SQLセッション内の試験であり、独立した複数接続の競合試験ではありません。

## 5. Current Phase Details

### Phase 3.2 — Sync Hardening

以下13項目はすべて未完了です。部分実装があっても、必要な検証が揃うまで閉じません。

| Task ID        | Phase | Description / 現在の根拠                                                                                                                                                                                                                                                                                                                                                                                                   | Priority | Status      | Dependencies                        | Verification requirements                                                                                                                                                                                         |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P32-WRITE      | 3.2   | Authenticated financial write permissions restricted via REVOKE and column-level GRANT. Plaid write paths migrated to Service Role Client after authentication and ownership checks. Destructive Web Seed route and Server Action removed. Local SQL authorization and route regression tests passed. Hosted migration and HTTP E2E verification remain pending. Direct category_source updates remain a known limitation. | P1       | IN PROGRESS | P02-REPRO                           | Verify anon/authenticated/service-role permissions, direct SQL/REST write restrictions, normal application operations, cross-user isolation, production build, hosted migration, and post-deployment smoke tests. |
| P32-STALE      | 3.2   | Stale worker behavior in `recordSyncFailure()`。user/item条件のみで更新し、lease token・期限・cursorの条件がない                                                                                                                                                                                                                                                                                                           | P1       | TODO        | P32-WRITE                           | worker Aが失効しBが成功した後、Aの失敗記録がBの状態やrevoked状態を上書きしないことを競合試験で証明                                                                                                                |
| P32-ACCOUNTS   | 3.2   | Account Refresh Atomicity。`persistPlaidAccounts`のupsertと欠落口座無効化は別操作。refresh routeは同期lease取得前に口座を更新する                                                                                                                                                                                                                                                                                          | P1       | TODO        | P32-WRITE, P32-STALE                | upsert後・無効化時・transaction commit前後の障害と並行更新を注入し、snapshotの整合性と復旧契約を確認                                                                                                              |
| P32-POSTED     | 3.2   | Pending-to-Posted Reconciliation。同期payloadに`pending_transaction_id`の保持・対応付けを確認できない                                                                                                                                                                                                                                                                                                                      | P1       | TODO        | P04-FIN, P31-VERIFY                 | pending/postedの異なるID、順不同イベント、削除・replayで二重計上やmanual category喪失が起きないこと                                                                                                               |
| P32-RETRY      | 3.2   | Durable Retry / Background Jobs。同期はrequest内で実行。永続queue・retry状態の実装を確認できない                                                                                                                                                                                                                                                                                                                           | P1       | TODO        | P32-STALE, P32-WEBHOOK              | process停止、timeout、rate limit、ページ取得中のmutationを含め、再開・backoff・idempotency・失敗隔離を実証                                                                                                        |
| P32-WEBHOOK    | 3.2   | Webhook Error Handling。busy時429/retry header、失敗時500は実装済み。一方Item検索のDBエラーとunknown Itemをともに200 ignoredにしている                                                                                                                                                                                                                                                                                     | P1       | IN PROGRESS | P32-STALE                           | transient DB障害とunknown/revoked Itemの区別、失敗記録自体の失敗、再送、HTTP応答を検証                                                                                                                            |
| P32-SIGNATURE  | 3.2   | Webhook Signature / Payload Validation。ES256、JWT age、body hashは実装・fixture試験あり。JSONは型assertionで、runtime schema検証を確認できない。key cacheの期限管理も要確認                                                                                                                                                                                                                                               | P1       | IN PROGRESS | P01-LOG                             | 不正JSON、型・必須項目、algorithm/kid、future/expired token、hash形式、key失効・ローテーションを検証                                                                                                              |
| P32-ISOLATION  | 3.2   | Sync-all Failure Isolation。loop内の1 Item失敗で409/500をreturnし、後続Itemを処理しない                                                                                                                                                                                                                                                                                                                                    | P1       | TODO        | P32-STALE                           | 成功・失敗・busy混在の複数Itemで、失敗が他のItemを止めず、応答と件数が契約どおりであること                                                                                                                        |
| P32-CONCURRENT | 3.2   | Concurrent Connection Tests。SQLには逐次stale-token試験があるが複数接続の実競合試験なし                                                                                                                                                                                                                                                                                                                                    | P1       | TODO        | P31-VERIFY, P32-STALE, P32-ACCOUNTS | 独立DB接続で同一/別Itemの競合、lease失効、cursor進行、必要なLink/exchange同時接続ケースを実行                                                                                                                     |
| P32-HTTP       | 3.2   | HTTP E2E。既存routeテストはhandler直接呼び出し＋依存mock                                                                                                                                                                                                                                                                                                                                                                   | P1       | TODO        | P02-REPRO, P32-SIGNATURE            | 起動したNext.js→認証cookie→HTTP route→DBまでの成功/拒否/障害を隔離環境で検証                                                                                                                                      |
| P32-CATEGORY   | 3.2   | Category Cross-User Integrity。通常RLSとmanual category actionは所有者確認あり。DBのcategory FKは単独IDで、service-role経路の複合所有権保証は未実証                                                                                                                                                                                                                                                                        | P1       | IN PROGRESS | P02-REPRO, P32-WRITE                | 別ユーザーcategoryへのtransaction/budget参照を通常role・特権経路で検証し、DB制約と許可契約の整合性を確認                                                                                                          |
| P32-INDEX      | 3.2   | Unique Index Review。transactionsにprovider ID単独とItem＋provider IDのUNIQUEが併存。categoriesに同じ列組のUNIQUE制約と別unique indexが存在                                                                                                                                                                                                                                                                                | P2       | TODO        | P02-REPRO                           | 実DBの制約・index、NULL semantics、provider ID範囲、ON CONFLICT先、重複indexコストを確認。削除は別途判断                                                                                                          |
| P32-HOSTED     | 3.2   | Hosted Database Consistency。履歴上は確認済みだが現在のHosted schema・RLS・grant・RPCとの一致は未検証                                                                                                                                                                                                                                                                                                                      | P1       | UNVERIFIED  | P02-REPRO                           | 対象環境を明示した読み取り専用比較でmigration history、関数、権限、index、生成型を照合し日時とcommitを保存                                                                                                        |

根拠: [recordSyncFailure](../src/features/plaid/server/recordSyncFailure.ts)、[syncPlaidItem](../src/features/plaid/server/syncPlaidItem.ts)、[口座永続化](../src/features/plaid/server/persitstPlaidAccounts.ts)、[refresh route](../src/app/api/plaid/refresh-accounts/route.ts)、[sync-all](../src/app/api/plaid/sync-all/route.ts)、[Webhook](../src/app/api/plaid/webhook/route.ts)、[署名検証](../src/app/api/plaid/webhook/verifyWebhooks.ts)、[category action](../src/features/transactions/server-actions.ts)、[route tests](../tests/plaid-routes.test.ts)。

### Phase 5 — Implemented behavior

データフローは次のとおりです。UIが独自にDBへ問い合わせる構造ではありません。

```text
PostgreSQL / Supabase PostgREST
  → getSubscriptionTransactions(fromDate)
  → toTransactionInput()
  → detectSubscriptions(transactions, asOfDate)
      → findRecurringTriples()
      → evaluateSubscriptionRecency()
  → SubscriptionCandidate[]
  → SubscriptionDashboard
```

| 報告された機能                       | コード確認結果と限界                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 最低3件・3連続月                     | 有効な3件を探索。入力全体の件数だけで判定しない                                                                                         |
| 同日または月末                       | 3連続月の同じ日、または各月末を判定。年跨ぎ・うるう年テストあり                                                                         |
| 金額変動±5%                          | 3件の**最初の支払額を基準**に±5%。中央値基準や全ペア間5%という意味ではない                                                              |
| account・merchant・currency grouping | merchantをtrim/lowercaseしたキーとaccount/currencyでgroup化                                                                             |
| Expenseのみ                          | 負の金額を対象。pending・removedは取得時とgroup化時に除外                                                                               |
| USD / CAD / JPY、minor units         | USD/CAD×100、JPY×1。非有限値・不正精度・safe integer外は変換で除外。unsupported currencyも除外                                          |
| 候補金額                             | 選択した3件の絶対額の中央値。候補は正のminor units                                                                                      |
| PostgreSQL adapter・pagination       | 認証ユーザーを取得しuser_idで絞り込み。500件単位のoffset pagination、posted_date/idの降順                                               |
| 認証                                 | `getUser()`で拒否し、protected layoutでもclaimsを確認。RLSの実環境動作確認とは別                                                        |
| 検索期間                             | UTCの当月1日から6か月前を下限とする既存計算。取得上限日はなく候補選択は維持。future last paymentのrecencyはunknown                      |
| Dashboard                            | 通貨別の推定月額・件数、merchant、cadence、最終支払日、観測recencyと予測日。recencyで候補や合計を除外しない。予測日は確定請求日ではない |
| Empty / Loading / Error              | 完全なEmpty State、route-level skeleton、client error boundaryの`reset()`。エラーを空配列に置き換えない                                 |
| 表示・accessibility                  | monogram fallback、長いmerchant名の折返し、モバイル用配置、reduced-motion対応。SSRテストだけで視覚・操作品質全体は保証しない            |
| 日付                                 | ISO日付をUTCで解釈しUTCで表示。4タイムゾーンの自動テストあり                                                                            |

### 今回の完了判定とレビュー範囲

- **P05-TRIPLE — DONE**: [15件の回帰テスト](../src/features/subscriptions/__tests__/findRecurringTriple.test.ts)に、以前の残件だった`finds a valid triple among multiple amount candidates deterministically`が含まれる。金額は最初の支払いに対する±5%で比較し、許容範囲で最も近い額ではなく、ソート済み候補の先頭を選ぶ決定規則として確認した。
- **P05-MULTI — DONE**: [detectSubscriptions tests](../src/features/subscriptions/__tests__/detectSubscriptions.test.ts)で同一merchantの異日、同日異額、月末と固定日の併存、6か月の非重複分割、入力逆順を検証。月末優先と料金帯の貪欲な消費が現在のMVP仕様。異なる契約を常に識別できるという完了判定ではない。
- **P05-RECENCY — DONE**: [domain tests](../src/features/subscriptions/__tests__/evaluateSubscriptionRecency.test.ts)、[mocked integration tests](../src/features/subscriptions/__tests__/subscriptionRecency.integration.test.ts)、[SSR tests](../src/features/subscriptions/__tests__/SubscriptionRecencyDisplay.test.ts)の計77件成功。[仕様](SUBSCRIPTION_RECENCY.md)に従う支払い観測の推定として完了。純粋関数、UTC、月単位計算、元の固定日を維持するclamp、graceの包含境界、未来/不正入力のunknown、同一requestで一度の評価日確定を確認した。
- **P01-LOG — DONE**: [db.ts](../src/features/plaid/server/db.ts)・[syncPlaidItem.ts](../src/features/plaid/server/syncPlaidItem.ts)は[allowlisted logger](../src/features/plaid/server/errors.ts)を使用。任意のerror messageやItem IDを直接ログへ渡す旧経路はなく、raw-console禁止・sentinel・routeテストが通過。lease cleanupと再throwの維持はコード確認であり、実DBの並行性を試験したという意味ではない。

互換性: `detectSubscriptions(transactions)`は従来の結果形を維持し、明示的な評価日を渡したときだけoptionalな`recency`を追加する。通常server経路は必ず評価日を渡す。recencyがunknownでも既存の検出候補・金額は保持する。同じmerchantの複数行は選択transaction IDsもReact keyに含めて区別する。

UI wording: `Recent payment observed`等の5ラベルと`Expected after last payment (estimate)`を使用する。予測日は最後の観測後の最初の予測日で、過去日になる場合もある。active/cancelled/unpaidを断定せず、stale sync・delayed posting・missing history・merchant normalizationの限界を明記する。HTML出力の検証であり、実browserレイアウト・操作の完了を意味しない。

今回のレビューでアプリコード修正を要する重大な正しさの問題は確認していない。下記の曖昧性・追加検証は残件として保持する。

### Phase 5 — Hardening backlog

従来の12項目のID・依存関係を維持し、今回指定されたP05-MULTIを台帳に追加しました。完了項目と残件を同じ表で追跡します。Phase 5全体の完了表ではありません。

| Task ID         | Phase | Description / 現在の根拠                                                                                                                              | Priority | Status      | Dependencies                       | Verification requirements                                                                                                                                           |
| --------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P05-RECENCY     | 5     | Payment observation recency estimation。明示asOfDate・UTC暦日・5観測状態・既定5日grace、serverで評価日を一度確定、SSR表示を実装。契約活動状態は対象外 | P1       | DONE        | P05-TRIPLE                         | 64 domain＋6 mocked integration＋7 SSR tests成功。固定日/月末/閏年/年跨ぎ/不正・未来日/境界/決定性/legacy互換を確認。実DB・browserはP05-AUTH/P05-E2Eで別管理        |
| P05-FALSEPOS    | 5     | False-positive reduction。同額の月次購入を契約と区別する根拠や評価データはない                                                                        | P2       | TODO        | P05-RECENCY                        | 通常購入と定期課金の評価fixture、誤検知/見逃しの評価基準を定義。confidenceを確率として扱わない                                                                      |
| P05-TRIPLE      | 5     | Latest recurring triple selection。最新有効3か月window、月末優先、固定日の降順、金額順と同額ID順で候補選択。許容幅内複数金額の回帰テストも存在        | P1       | DONE        | なし                               | findRecurringTriple 15件成功。新旧window、最新不成立時fallback、同月複数候補、month-end、ID tie、複数許容金額、入力逆順・非破壊性を確認。全候補の最適性は主張しない |
| P05-MULTI       | 5     | 同じaccount/merchant/currency内で異なる日・分離できる金額帯の定期支払いを複数検出。同料金帯の6か月を重複分割せず、使用済みIDを共有しない              | P1       | DONE        | P05-TRIPLE                         | detectSubscriptions 10件中の5つのmulti回帰ケースが成功。同日異額、月末と固定日、6か月連続、逆順を確認。重なる料金帯の契約識別は既知制限                             |
| P05-MERCHANT    | 5     | Merchant display name versus grouping key。group化時にlowercaseした値が候補の表示名にも流れる                                                         | P2       | TODO        | なし                               | 表示名と正規化キーの契約、大文字小文字・空白・表記差・nullの扱いを定義して検証                                                                                      |
| P05-DUPLICATE   | 5     | Duplicate transaction protection。DBのUNIQUEはあるがDomainでIDによるdedupはない。取得時の重複・競合も未試験                                           | P1       | IN PROGRESS | P32-INDEX, P05-PAGINATION          | 同じIDの繰返し、replay、別IDの同日支払いを区別し、候補金額・件数が不正に増えないこと                                                                                |
| P05-MONEY       | 5     | Money correctness。minor-unit変換とmedianは実装済み。±5%境界、丸め、合算overflow等の全経路保証はない                                                  | P1       | IN PROGRESS | P04-FIN                            | DB numeric→JS number→minor units→推定合計の境界テストと許容誤差仕様。DB桁上限・safe integerも確認                                                                   |
| P05-CURRENCY    | 5     | Currency correctness。3通貨の変換・表示・別集計はテスト済み。通貨はaccountから取得しておりtransaction通貨との差異・unsupported除外の可視性は未整理    | P1       | IN PROGRESS | P04-FIN                            | account/provider通貨の一致、欠落・非対応・非公式コードの方針、通貨混在非合算を確認                                                                                  |
| P05-PAGINATION  | 5     | Pagination correctness。500件offset＋二重sortは実装済み。実取得処理のページ境界テストなし                                                             | P1       | IN PROGRESS | P02-REPRO                          | 0/499/500/501/1000件、同日、途中エラー、並行insert/removeで欠落・重複の契約を検証                                                                                   |
| P05-PERFORMANCE | 5     | Query performance。期間内全件をメモリに収集して検出。実測なし                                                                                         | P2       | TODO        | P05-PAGINATION, P05-INDEX          | 代表件数でDB query、転送量、検出時間・メモリを計測し許容値を定義                                                                                                    |
| P05-INDEX       | 5     | Index design。既存user/date indexはあるがidを含むsortとpending/removed/amount条件への適合を実測していない                                             | P2       | TODO        | P32-INDEX                          | 代表データのEXPLAIN計画・読み取りコストを確認し、書込みコストを含めindex方針を決定                                                                                  |
| P05-ERROR       | 5     | Error handling。例外伝播・generic error UIあり。取得例外にはDB error.messageを付加しており、server logの露出範囲も未検証                              | P1       | IN PROGRESS | P01-LOG, P05-PAGINATION            | auth失敗・途中ページ失敗・不正行・再試行を検証し、emptyへの誤変換と機密露出がないこと                                                                               |
| P05-AUTH        | 5     | Authentication and RLS verification。コード上の認証・user絞り込みはあり。実role/他ユーザーとの隔離テストなし                                          | P1       | UNVERIFIED  | P02-REPRO, P32-WRITE, P32-CATEGORY | 未認証・期限切れ・別ユーザーの取引/口座、account joinを実DBで検証。service-roleの不用意な使用がないこと                                                             |

## 6. Open Issues and Technical Debt

### 履歴と現在の証拠の差分

1. **P01-LOG回帰は解消済み。** 11月22日の`ac0cece`監査ではraw console禁止テストが失敗したが、`5568495`でsanitized loggerへ統一され、今回はsecurity系120件・全体292件が成功した。失敗履歴はChange Logに残し、現在の未解決問題とは扱わない。P01-RECHECKのsecurity build・dependency確認は未完了。
2. **READMEと構成資料は現在の実装より古い。** [README](../README.md)の「専用テストスクリプトなし」「同期保存が非原子的」、[PROJECT_SUMMARY_MODIFIED](../PROJECT_SUMMARY_MODIFIED.md)の「migration/RLS定義なし」は現在のリポジトリと一致しない。ただしaccount snapshotまで原子的になったわけではない。本監査では既存文書を編集しない。
3. **migrationやSQLテストの存在は、現在のLocal/Hosted DBの一致を証明しない。** Phase 2適用成功、Phase 3.1統合成功、Netflix統合成功とcleanupは過去報告として保持する。
4. **P05-TRIPLEの旧残件は検証済み。** 最新window、日付優先、同額ID tieに加え、許容幅内の複数金額候補を選ぶテストが現在は存在する。IN PROGRESSという旧記載をDONEへ統一した。
5. **Positive UIの検証範囲を区別する。** 過去の会話には隔離HTML・fixtureによるdesktop/mobile previewの報告がある。しかし認証済み実ページ→実DBのPositive E2Eではない。「最新DashboardのPositive実データbrowser検証は未完了」という依頼文と矛盾しない。最新Empty State smoke成功も今回は再実行していない。
6. **Financial Correctnessはアプリ全体では未完了。** [summary SQL](../supabase/migrations/20261112000000_add_sync_lease_and_monthly_summary.sql)は通貨別groupを持たず、[formatValue](../src/lib/formatValue.ts)はCAD固定。dashboard/budget等のqueryはSubscriptionと同じpending除外方針に統一されていない。Subscription内の通貨分離を全機能へ一般化してはいけない。
7. **再現用設定に確認残件がある。** `supabase/config.toml`はseedを有効にして`./seed.sql`を参照するが、そのファイルは存在しない。これが実際の起動・migration検証へどう影響するかは未実行で、失敗すると断定しない。

8. **P05-MULTIは契約識別ではなく支払いパターンのMVP分割。** 同じ日・同じまたは重なる±5%料金帯の別契約は統合され得る。料金変更が別料金帯に入ると別候補になり得る。月末優先で料金帯の取引をまとめて消費するため、重なるパターンの全組合せや最適分割を保証しない。P05-FALSEPOS/P05-MONEY/P05-DUPLICATEを開いたままにする。
9. **決定性の範囲を限定する。** 同一group内のwindow/日付/金額/ID選択と複数候補順はテスト済み。`detectSubscriptions`の異なるmerchant/account/currency group間はMapの挿入順で、全体配列のグローバル順序不変は保証しない。同じIDを持つ矛盾した入力は未検証でP05-DUPLICATEの範囲。
10. **P05-RECENCYは選択tripleの観測推定。** 後続の不規則な支払いを含む全履歴の在否や契約の停止・再開は確定しない。祝日・週末の請求調整、merchant独自grace、ページ表示後の自動日付更新は対象外。fixed-day clampはforecastのみで、元の検出器が受け付ける日付パターンを拡張しない。recencyのDONEはP05-AUTH/P05-E2Eの未完了状態を変更しない。

### その他のタスク状態

この表とPhase 3.2/5の表をタスク台帳とします。DONEも証拠と依存関係を保持するため残します。依存関係は着手・完了の前提であり、今回実行する許可ではありません。

| Task ID     | Phase | Description                                                                                                               | Priority | Status     | Dependencies                                                 | Verification requirements                                                                                                         |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| P00-AUDIT   | 0     | 過去architecture auditの完了条件を照合し、古いREADME/構成資料の扱いを整理                                                 | P2       | UNVERIFIED | 本文書レビュー                                               | source map・既存指摘・解消証拠を対応付け、文書差分の更新方針を承認                                                                |
| P01-LOG     | 1     | Plaid sync helpersのraw consoleをallowlisted sanitized loggerへ統一済み。stage失敗の再throwとfinallyのlease解放構造を保持 | P0       | DONE       | 本文書レビュー                                               | server-boundaries 16件、plaid-errors 10件、mocked plaid-routes 25件と全体292件成功。実DB並行動作・全stage障害注入はこの完了範囲外 |
| P01-RECHECK | 1     | dependency/security buildの過去成功を現commitで再検証                                                                     | P1       | UNVERIFIED | P01-LOG                                                      | lockfileに対するaudit、隔離security build、client secret scanとnegative import試験の結果を保存                                    |
| P02-REPRO   | 2     | Local DB再現性、seed設定、migration適用手順の再確認                                                                       | P1       | UNVERIFIED | 対象DB・実行範囲の明示と承認                                 | 隔離DBで3本のmigration、schema/権限/関数、seed有無の契約を再現し、結果を保存                                                      |
| P31-VERIFY  | 3.1   | 11項目のatomic SQL統合テストの現commit再検証                                                                              | P1       | UNVERIFIED | P02-REPRO                                                    | 指定された空の隔離DBのみで実行し11項目成功とrollback後fixture不在を確認。今回は禁止範囲                                           |
| P04-FIN     | 4     | 全機能の符号、通貨、精度、pending/removed、日付期間、返金・移動の会計ルール整理                                           | P1       | TODO       | 本文書レビュー                                               | dashboard/transaction/budget/account/Subscriptionに共通の入力fixtureと期待値を定義し、一致を検証                                  |
| P05-E2E     | 5     | 最新Subscriptionページの認証付きPositive/Empty/Loading/Error browser検証                                                  | P1       | UNVERIFIED | P02-REPRO, P05-AUTH, P05-ERROR                               | デスクトップ/モバイル、実取得経路、3通貨、長い名前、overflow、keyboard/retry、fixture cleanupの証拠を保存                         |
| P06-AI      | 6     | AI Insightsの要件・評価・データ利用境界を定義                                                                             | P3       | TODO       | P04-FIN, P05-RECENCY                                         | 入力の信頼性、説明根拠、誤回答、privacy/costを評価してから公開判断                                                                |
| P07-RELEASE | 7     | リリース基準・環境分離・Subscription公開可否を決定                                                                        | P1       | TODO       | P01-LOG, P01-RECHECK, P32-HOSTED, P32-HTTP, P04-FIN, P05-E2E | 未解決リスク承認、production build、環境確認、デプロイSHA/結果、smoke、rollback計画。guard変更は独立判断                          |
| P08-INFRA   | 8     | AWS / Terraformの必要性と構成を検討                                                                                       | P3       | TODO       | P07-RELEASEの運用要件                                        | 現Vercel運用との役割、state管理、権限、費用、再現・破棄・復旧手順を検証                                                           |
| P09-CI      | 9     | CI/CDの実行ゲートを整備                                                                                                   | P2       | TODO       | P01-LOG, P02-REPRO                                           | 型・lint・unit・隔離DB統合・buildを自動実行し、失敗でreleaseを止める。秘密管理と承認経路も確認                                    |
| P10-OBS     | 10    | 監視・計測・アラートとSLOを整備                                                                                           | P2       | TODO       | P01-LOG, P32-RETRY                                           | sync遅延/失敗、DB障害、retry滞留を検知し、機密値なしで原因追跡できること                                                          |
| P11-IR      | 11    | インシデント対応・復旧・credential rotationの手順を作成                                                                   | P2       | TODO       | P07-RELEASE, P10-OBS                                         | DB復旧、誤同期、認証/秘密情報事故の演習を実施し、担当と復旧目標を記録                                                             |
| MAINT-LINT  | 0     | 既存lint warning 5件の整理                                                                                                | P2       | TODO       | 本文書レビュー                                               | root font link、unused `_day` 2件、budget catch変数2件を別作業で整理しlintを確認                                                  |

## 7. Verification Matrix

すべての「今回実行」は2026-11-24の`e640ffe`＋開始時の未コミットP05-RECENCY変更に対する結果です。過去の失敗と後続の成功はChange Logで区別します。

| 対象 / コマンド                                       | 証拠区分                 | 結果                                                                                             | 状態 / 限界                                                                            |
| ----------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `git status --short` / branch / HEAD / log -8         | 今回実行                 | 開始時tracked 4件変更＋untracked 5件。branch/HEADはSection 2記載                                 | DONE：ローカルcheckoutの確認のみ                                                       |
| Subscription tests（今回の全体実行から集計）          | 今回実行                 | 12 files / **172 passed**                                                                        | DONE：既存95件＋recency 77件。DB・HTTP実接続なし                                       |
| `npm test`（verbose/JSON reporterを指定）             | 今回実行                 | 18 files / **292 passed、0 failed**                                                              | DONE：P01-LOG回帰解消。DB・auth・browser E2Eとは別                                     |
| `npx tsc --noEmit`                                    | 今回実行                 | exit 0                                                                                           | DONE：アプリソースの変更なし。既存設定のincremental cacheはGit ignored                 |
| `npm run lint`                                        | 今回実行                 | exit 0、0 errors / 5 warnings                                                                    | DONE：warning残件は`MAINT-LINT`                                                        |
| Phase 1 security build・dependency audit              | 過去報告                 | security-baseline.mdは成功・脆弱性0を報告                                                        | UNVERIFIED：現在の再実行結果ではない。公開時点で再確認が必要                           |
| Phase 2 Local/Hosted migration適用                    | 過去報告＋コード確認     | 3本のmigrationあり。適用成功は依頼文の報告                                                       | UNVERIFIED：DB未接続、drift未比較                                                      |
| Phase 3.1 SQL integration                             | 過去報告＋テスト定義確認 | 11ケースの再現可能なSQLファイルあり。過去に主要試験成功と報告                                    | UNVERIFIED：INSERT/UPDATEを行うため、rollback設計でも今回の実行対象外                  |
| Netflix Local DB positive integration                 | 過去報告                 | 月次3件から1候補を検出したとの報告                                                               | UNVERIFIED：現在のDB/commitで再現していない。専用Subscription DB統合テストは確認できず |
| Netflix temporary data cleanup                        | 過去報告                 | cleanup済みとの報告                                                                              | UNVERIFIED：今回DBを照会していない                                                     |
| Latest Empty State smoke                              | 過去報告                 | 成功との報告                                                                                     | UNVERIFIED：今回browser起動・再実行なし                                                |
| Isolated UI fixture browser preview                   | 過去の会話の報告         | 複数幅・各UI状態のpreview成功                                                                    | UNVERIFIED：今回未再実行。認証・DB・実route E2Eを代替しない                            |
| 最新Positive UIの実データbrowser E2E                  | 未検証                   | 完了証拠なし                                                                                     | UNVERIFIED：`P05-E2E`                                                                  |
| Hosted auth/RLS、並行接続、HTTP E2E                   | コード確認のみ           | 関連実装・mock testsはある                                                                       | UNVERIFIED：`P05-AUTH`、`P32-CONCURRENT`、`P32-HTTP`                                   |
| `git diff --check`、新規文書のwhitespace/変更範囲確認 | 今回実行                 | exit 0。新規untrackedファイルもwhitespace確認。今回の差分は進捗文書＋recency文書の状態参照文のみ | DONE：開始時の未コミット実装・テストを変更していない                                   |

[test setup](../tests/setup.ts)は合成設定を使用しfetch/HTTP/socketアクセスを拒否します。[Vitest config](../vitest.config.mts)はNode環境で`.test.ts`を収集します。route testsのmockやSQLファイルを読み取るだけの確認を、実際の認証・RLS・HTTP検証と数えません。

## 8. Environment and Deployment Status

以下の環境ファイル確認は2026-11-22の監査記録であり、今回は再読込・DB接続・deployment照会をしていません。前回は値を出力せず、存在、キーの有無、接続先の分類、Git ignoreだけを確認しました。URL、project reference、credential値は本書へ記録しません。

| 項目                     | 確認結果                                                                                                                                                              | 未検証事項                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `.env.development.local` | 存在しGit ignored。Supabase URLはloopback分類。Supabase URL/public key/service-role keyの設定あり                                                                     | 鍵と実DBの対応、稼働状態、認証成功は未検証                                                                    |
| `.env.local`             | 存在しGit ignored。Supabase URLはHosted分類。Supabase/Plaidの必要キーが存在し`PLAID_ENV`はSandbox                                                                     | Hostedの有効性・migration状態・deployment設定を意味しない                                                     |
| 開発時の設定混在         | `.env.development.local`にはPlaid client ID/secret/環境指定がない。インストール済み`@next/env`はdevelopment用local file→`.env.local`→mode file→`.env`を読む順序を持つ | 上位プロセスの設定などで実効値は変わる。Local DB向け設定があるだけで外部Plaidアクセスも無効になるとは限らない |
| Supabase local config    | API 54321、DB 54322、PostgreSQL 17、local auth site、seed有効                                                                                                         | コンテナ起動・CLIリンク先未確認。参照seed.sqlは不存在                                                         |
| Subscription route       | `NODE_ENV !== "development"`なら`notFound()`。認証付きdevelopment限定。6か月lookbackを保持                                                                            | 公開可否の承認なし。production/previewを自動で有効化しない                                                    |
| DBアクセス経路           | 通常取得はsession-aware client。atomic sync RPCはserver-only service-role client                                                                                      | 環境ごとのcredential、grant/RLS、実効接続先の一致は未検証                                                     |
| Vercel / 公開状態        | READMEに公開アプリへのリンクがある                                                                                                                                    | 現deployment ID、SHA、health、公開branch、環境設定は未照会                                                    |

**Git commit/pushは本番リリースの証拠ではありません。** 現在のローカルcommitと動作中deploymentの対応は不明です。最新Subscription UIについてはdevelopment guardがあり、リリース済みと記録しません。

## 9. Next Action Queue

既存の優先順・チーム方針を維持し、次の5枠の状態だけを更新します。**本文書のレビュー後に別途着手する作業**であり、今回実装は進めません。各IDの状態・依存・完了検証は上の台帳を参照してください。

1. **P01-LOG — DONE** — sanitized loggingと全292件成功を確認済み。再実装せず、既存の回帰テストを維持する。
2. **P32-WRITE — IN PROGRESS** — Local implementation and
   SQL/route regression tests passed. Destructive Web Seed
   functionality removed. Final build verification, commit,
   hosted rollout and HTTP verification remain pending.
   ### P32-WRITE — Local Verification Evidence (2026-11-25)

Status: IN PROGRESS — Local implementation verified,
hosted rollout pending.

Migrations:

- 20261124173147_restrict_authenticated_financial_writes.sql
- 20261125104652_restrict_anon_financial_access.sql

Verified:

- Anonymous financial table access denied.
- Authenticated financial writes restricted.
- Column-level UPDATE permission contract verified.
- Owner category updates allowed.
- Cross-user transaction updates denied.
- Service Role item and account updates allowed.
- SQL regression tests passed with ROLLBACK.
- Destructive Web Seed functionality removed.
- Vitest: 299/299 passed.
- TypeScript: PASS.
- ESLint: 0 errors, 5 existing warnings.
- Production build: PASS.

Remaining:

- Hosted database privilege and migration review.
- Backup and recovery preparation.
- Application deployment.
- Hosted migration application.
- Direct REST and authenticated HTTP E2E verification.
- Post-deployment smoke tests.
- category_source and cross-user category integrity
  limitations tracked under P32-CATEGORY.

3. **P32-STALE** — 古いworkerの`recordSyncFailure()`が新しい同期状態を壊さないようにする。
4. **P32-ACCOUNTS** — 口座snapshot更新とtransaction syncの部分失敗・競合に対する整合性を保証する。
5. **P32-CATEGORY** — category参照のユーザー境界を通常roleと特権経路の両方で検証する。

Local再現性・実DB試験・Hosted比較は各項目の必要な前提として実施計画を立てます。対象DBの明示とデータ変更を含む試験の承認なしに、今回の監査から継続実行しません。

## 10. Definition of Done

個別タスクを`DONE`へ変更するには、次を記録します。

- 対象Task ID、仕様・範囲、実装commit、実行日、環境を明記する。
- 台帳のverification requirementsを満たす再現手順と結果を残す。失敗・制約・除外範囲も記録する。
- 型・lint・関連テストを確認し、全体テストの回帰を残さない。既存warningの許容は明示する。
- 認可・DB変更はrole/tenantの否定ケース、migration再現性、rollback・cleanup、必要な競合試験を確認する。
- 金額・通貨・日付は定義した契約に一致させ、推定値を確定契約として表示しない。
- UIは実routeと認証を含むPositive/Empty/Loading/Error、mobile/desktop、keyboard/retryを必要な範囲で検証する。
- 更新理由と証拠をChange Logへ追記する。試験の存在、過去の成功報告、pushのみで完了にしない。

Phase 5完了には従来の12項目のHardening、追加管理した`P05-MULTI`、`P05-E2E`の解決、または明示された仕様上の除外・リスク承認が必要です。Phase 7完了には公開判断、対応するdeployment証拠、smoke、監視・rollback責任が必要です。開発専用guardの解除は自動的な後続作業ではありません。

今回の文書更新の完了条件は、既存11セクション・ロードマップの順序・既存Task IDと依存関係を維持し、13件のSync Hardeningと従来12項目＋P05-MULTIの状態・証拠を整合させることです。変更は進捗文書とrecency仕様の状態参照文に限定し、既存の未コミット実装・テストは保持します。プロジェクトの実装完了を意味しません。

## 11. Change Log

| Date（America/Vancouver） | 対象                                              | 変更 / 証拠                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22                | 初回監査 / `ac0cece`                              | roadmapを維持して進捗台帳を新規作成。開始時working treeはclean                                                                                                                     |
| 2026-11-22                | Phase 5                                           | Subscription 84件成功を再確認。Domain/Adapter/UI実装とhardening残件を分離                                                                                                          |
| 2026-11-22                | Phase 1 / 全体検証                                | 全体204件中1件失敗を新規記録。TypeScript成功、lint 0 errors / 5 warnings。修正は未実施                                                                                             |
| 2026-11-22                | 環境・証拠の整理                                  | Local/Hosted設定の分類を値非公開で確認。DB試験・cleanup・smokeの過去報告を独立検証と区別                                                                                           |
| 2026-11-22                | 文書検証                                          | ファイル存在、内部リンク、11見出し、固定Task ID、13＋12の残件、次の5件を確認。`git diff --check`と新規文書のwhitespace検査を通過。最終statusは本ファイルのみ追加、既存ファイル不変 |
| 2026-11-22                | Follow-up Verification（過去報告を統合）          | 元文書に重複していた記録を統合。209/209件・Subscription 89/89件成功、型・lint・diff成功、P01-LOG DONE、当時P05-TRIPLE IN PROGRESS。現在値はSection 2/7を参照                       |
| 2026-11-24                | Finalization review / `e640ffe`＋既存working tree | P05-TRIPLE、P05-MULTI、P05-RECENCY、P01-LOGを限定実装・ローカル検証範囲でDONE。P05-MULTIを欠けていた台帳へ追加。既存ID・依存は維持                                                 |
| 2026-11-24                | Verification                                      | 全体292/292件（18 files）、Subscription 172/172件（12 files）。npx tsc --noEmit成功、lint 0 errors / 5 existing warnings、git diff --check成功                                     |
| 2026-11-24                | Remaining / scope                                 | Phase 5はIN PROGRESS。実DB・auth/RLS・browser E2E、料金帯の曖昧性等を保持。アプリ・テスト・DB schema変更、commit/push/deployなし。既存の未コミット実装を保持                       |
