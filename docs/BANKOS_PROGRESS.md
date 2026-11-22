# BankOS Development Progress

最終監査日: **2026-11-22（America/Vancouver）**

監査対象: `feat/subscription-detection` / `ac0cece`

この文書は実装・検証・未解決事項を区別して管理する進捗の基準資料です。完了判定は項目ごとの範囲に限定し、実装やユニットテストの存在だけで本番運用可能とは判断しません。

## 1. Project Overview

BankOSはNext.js App Router、React、TypeScript、Tailwind CSS、Supabase Auth/PostgreSQL、Plaidを使う個人向け家計管理アプリです。認証、銀行口座接続、取引同期、取引一覧、ダッシュボード、予算管理、定期支払い検出の実装があります。PlaidはSandbox中心の検証段階です。

今回の監査はリポジトリの読み取りとネットワークを遮断した既存テストの実行に限定しました。変更対象は本ファイルのみです。DBへの接続・データ変更、マイグレーション適用、環境ファイル変更、デプロイ、コミット、pushは実施していません。

**Detected Recurring Payment != Confirmed Active Subscription**

検出対象は過去の取引に見られる月次パターンです。現在有効な契約、次回請求、解約可能性を保証しません。`confidence: 0.7`は固定のヒューリスティック値で、統計的な確率ではありません。

証拠を次のように区別します。

- **今回実行**: この監査で実行して結果を確認したコマンド。
- **コード確認**: 現在のソース、SQL、テスト定義から確認した実装。実環境での動作確認とは別。
- **過去報告**: 依頼文、過去の会話、既存ドキュメントによる報告。今回の独立した再検証はない。
- **未検証**: 現在の環境・commitに結びつく十分な実行証拠がない。

状態: `DONE`＝記載範囲の実装・検証が完了、`IN PROGRESS`＝一部実装済みで残件あり、`TODO`＝対応が必要、`BLOCKED`＝具体的な前提不足で進められない、`UNVERIFIED`＝主張または環境状態を未検証。優先度はP0＝現在の検証ゲートを破る回帰、P1＝認可・整合性・主要検証、P2＝品質・性能、P3＝将来計画です。

## 2. Current Development Snapshot

| 項目                     | 今回確認した状態                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Branch                   | `feat/subscription-detection`                                                        |
| HEAD                     | `ac0cece`（完全SHA: `ac0cece9e0b715c85c986f02cd9f36351ff07e66`）                     |
| 監査開始時のworking tree | `git status --short`の出力なし。クリーン。以前の会話にあった未コミット状態とは異なる |
| 文書作成後のworking tree | `?? docs/BANKOS_PROGRESS.md`のみ。既存ファイルは保持                                 |
| Subscription             | Domain、Adapter、UI、19件の追加テストがcommitに含まれる。Hardeningは未完了           |
| Subscriptionテスト       | **9ファイル、84件成功**（今回実行）                                                  |
| 全体Vitest               | **15ファイル、204件中203件成功・1件失敗**（今回実行）                                |
| TypeScript / ESLint      | 型チェック成功。lintは0 errors / 5 warnings                                          |
| Release                  | このcommitの本番デプロイ・承認・稼働状態は`UNVERIFIED`                               |

直近8件のcommit（`git log -8 --oneline`）:

```text
ac0cece feat(subscriptions): add subscription loading and error components, enhance dashboard with detected subscriptions
a42f8dc feat(subscriptions): implement subscription detection and conversion logic
88d0821 feat(subscriptions): add subscription detection and related tests
19ad6c9 feat(plaid): implement atomic sync RPC and integration tests
a13f08f fix(db): reproduce sync leases and monthly summary RPC
bbdddb6 feat(plaid): implement error logging and webhook verification improvements
d5adbd0 Update README.md
0d9d02e Revise README for BankOS project overview and setup
```

`ac0cece`にはUIとテストだけでなくPlaid同期のログ変更も含まれます。今回見つかったセキュリティ境界テストの失敗を、Subscriptionの84件成功で覆い隠してはいけません。

## 2026-11-22 — Follow-up Verification

Branch: feat/subscription-detection
Status: Uncommitted changes verified

### Verification

- Full Vitest: 209/209 PASS (15 files)
- Subscription: 89/89 PASS
- TypeScript: PASS
- ESLint: 0 errors / 5 existing warnings
- git diff --check: PASS

### P01-LOG — DONE

- Removed raw console calls from Plaid sync helpers.
- Reused allowlisted sanitized logging.
- Preserved error propagation and lease cleanup behavior.
- Security boundary and logger tests passed.
- Full regression suite passed.

### P05-TRIPLE — IN PROGRESS

- Latest valid three-month window selection verified.
- Latest payment date prioritized within a window.
- Month-end patterns prioritized.
- Same-amount transaction ties sorted by ID.
- Fourteen findRecurringTriple tests passed.
- Remaining: verify combinations involving multiple
  amount candidates inside the allowed tolerance.

### Remaining

- Actual DB concurrency behavior not reverified.
- Production security and deployment not verified.
- Existing lint warnings remain.

## 3. Master Roadmap

Phaseの番号・順序・名称は従来のロードマップを維持しています。「従来報告」は履歴であり、今回の検証結果とは別です。

| Phase | Description              | 従来報告                                              | 現在の監査状態 | 判定根拠 / 残件                                                                                              |
| ----- | ------------------------ | ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| 0     | Architecture Audit       | Complete                                              | UNVERIFIED     | 既存の構成資料はあるが古い記述を含む。Phase全体の完了条件・承認記録は未確認。`P00-AUDIT`                     |
| 1     | Security Baseline        | Complete                                              | IN PROGRESS    | セキュリティ実装と120件の既存テストはあるが、現在119件成功・1件失敗。`P01-LOG`                               |
| 2     | Database Reproducibility | Local/Hosted migrations verified                      | UNVERIFIED     | 3本のmigrationは存在。Local/Hostedへの適用結果・現時点の差分は今回未検証。`P02-REPRO`                        |
| 3.1   | Atomic Plaid Sync        | Main integration tests passed                         | UNVERIFIED     | atomic RPCと11項目のSQLテストは実装済み。今回SQLは未実行。口座更新はRPCの対象外。`P31-VERIFY`                |
| 3.2   | Sync Hardening           | Incomplete                                            | IN PROGRESS    | leaseやWebhook検証は一部実装済み。下記13項目を継続管理                                                       |
| 4     | Financial Correctness    | Not started                                           | TODO           | Subscription内のminor-unit対応はあるが、アプリ全体の通貨・pending・丸め・期間の整合性検証は未完了。`P04-FIN` |
| 5     | Subscription Detection   | Domain, Adapter and UI implemented; Hardening pending | IN PROGRESS    | 84件成功。実DB・認証付きPositive UI E2Eと12項目のHardeningが残る                                             |
| 6     | AI Insights              | Future                                                | TODO           | 対応する実装・評価証拠は今回の検索で確認できず。`P06-AI`                                                     |
| 7     | Production Readiness     | Future                                                | TODO           | リリースゲート未充足。Subscriptionはdevelopment限定。`P07-RELEASE`                                           |
| 8     | AWS / Terraform          | Future                                                | TODO           | Terraform構成を確認できず。`P08-INFRA`                                                                       |
| 9     | CI/CD                    | Future                                                | TODO           | `.github`ディレクトリなし。外部サービス上の自動化は未確認。`P09-CI`                                          |
| 10    | Observability            | Future                                                | TODO           | ログ実装はあるが監視・アラート・SLOの運用証拠なし。`P10-OBS`                                                 |
| 11    | Incident Response        | Future                                                | TODO           | インシデント対応・復旧訓練の資料を確認できず。`P11-IR`                                                       |

## 4. Completed Work and Evidence

以下の`DONE`は限定された実装・テストの範囲です。Phase全体の完了やHosted環境への適用を意味しません。

| 項目                        | 状態 | 確認した実装・証拠                                                                                                                                                                                                                                                                    | 検証の限界                                                                    |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 認証・保護ルートの構造      | DONE | [Protected layout](<../src/app/(protected)/layout.tsx>)、[Supabase server client](../src/lib/supabase/server.ts)、[認証redirectテスト](../tests/auth-redirect.test.ts)                                                                                                                | 実セッション・Hosted RLSのE2Eではない                                         |
| セキュリティ基盤の導入      | DONE | [security-baseline.md](security-baseline.md)、server-only、allowlist型logger、各Plaid routeのerror boundary                                                                                                                                                                           | 全体の現在の合格状態は失われている。`P01-LOG`参照                             |
| DB定義のリポジトリ管理      | DONE | [基礎schema/RLS](../supabase/migrations/20260903011843_remote_schema.sql)、[lease・月次summary](../supabase/migrations/20261112000000_add_sync_lease_and_monthly_summary.sql)、[atomic commit](../supabase/migrations/20261113130431_plaid_sync_atomic_commit.sql)                    | ファイルの存在・内容を確認。現DBへの反映は未検証                              |
| Atomic transaction sync実装 | DONE | [db.ts](../src/features/plaid/server/db.ts)がservice-role clientから`commit_plaid_sync`を呼ぶ。SQLは取引・カテゴリ・cursorを同一RPC内で更新                                                                                                                                           | account snapshot、failure記録、lease取得・解放は別操作                        |
| SQL統合テスト定義           | DONE | [atomic_sync_integration.sql](../supabase/tests/atomic_sync_integration.sql)に11項目                                                                                                                                                                                                  | 成功メッセージのSQL定義は実行ログではない。今回未実行                         |
| Subscription Domain         | DONE | [detectSubscriptions](../src/features/subscriptions/domain/detectSubscriptions.ts)、[findRecurringTriple](../src/features/subscriptions/domain/findRecurringTriple.ts)、[groupTransactions](../src/features/subscriptions/domain/groupTransactions.ts)                                | 活動中判定・誤検知率・全境界ケースの保証はない                                |
| Subscription Adapter        | DONE | [取得処理](../src/features/subscriptions/server/getSubscriptionTransactions.ts)、[変換処理](../src/features/subscriptions/server/toTransactionInput.ts)、[orchestration](../src/features/subscriptions/server/getDetectedSubscriptions.ts)                                            | orchestrationテストはDB取得をmock。実PostgREST pagination/RLSを検証していない |
| Subscription UI             | DONE | [Dashboard](../src/features/subscriptions/components/SubscriptionDashboard.tsx)、[formatting](../src/features/subscriptions/components/formatSubscription.ts)、[loading](<../src/app/(protected)/subscription/loading.tsx>)、[error](<../src/app/(protected)/subscription/error.tsx>) | HTMLテストはCSSレイアウト、hydration、実サービスを含まない                    |
| Subscription自動テスト      | DONE | [tests](../src/features/subscriptions/__tests__)の既存7ファイル65件＋UI/formatting 2ファイル19件＝84件が今回成功                                                                                                                                                                      | UI4件、formatting15件。loading/errorの専用永続テストはこの19件に含まれない    |

Atomic RPCのコードにはItem行の`FOR UPDATE`、所有者、lease token・期限、expected cursor、revoked状態の検査があります。`SECURITY INVOKER`で、実行権限は`PUBLIC`・`anon`・`authenticated`からrevokeし`service_role`に付与する定義です。このRPCの保護と、認証済みユーザーによるテーブル直接更新権限は別問題です。

SQLテストの11項目は、通常commit、manual category保持、replayの重複防止、soft delete、再有効化、途中失敗rollback、誤token、期限切れtoken、stale worker、cursor不一致、revoked Itemです。同一SQLセッション内の試験であり、独立した複数接続の競合試験ではありません。

## 5. Current Phase Details

### Phase 3.2 — Sync Hardening

以下13項目はすべて未完了です。部分実装があっても、必要な検証が揃うまで閉じません。

| Task ID        | Phase | Description / 現在の根拠                                                                                                                                                                                        | Priority | Status      | Dependencies                        | Verification requirements                                                                                                         |
| -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P32-WRITE      | 3.2   | Authenticated User direct column write permissions。基礎migrationは`accounts`、`plaid_items`、`transactions`等にテーブル単位のINSERT/UPDATE等を付与。所有者RLSだけではcursor・lease・provider由来列を区別しない | P1       | TODO        | P02-REPRO                           | anon/authenticated/service-roleごとに列別の許可契約を定義し、直接REST/SQL更新が許可・拒否されることを検証。通常のアプリ操作も維持 |
| P32-STALE      | 3.2   | Stale worker behavior in `recordSyncFailure()`。user/item条件のみで更新し、lease token・期限・cursorの条件がない                                                                                                | P1       | TODO        | P32-WRITE                           | worker Aが失効しBが成功した後、Aの失敗記録がBの状態やrevoked状態を上書きしないことを競合試験で証明                                |
| P32-ACCOUNTS   | 3.2   | Account Refresh Atomicity。`persistPlaidAccounts`のupsertと欠落口座無効化は別操作。refresh routeは同期lease取得前に口座を更新する                                                                               | P1       | TODO        | P32-WRITE, P32-STALE                | upsert後・無効化時・transaction commit前後の障害と並行更新を注入し、snapshotの整合性と復旧契約を確認                              |
| P32-POSTED     | 3.2   | Pending-to-Posted Reconciliation。同期payloadに`pending_transaction_id`の保持・対応付けを確認できない                                                                                                           | P1       | TODO        | P04-FIN, P31-VERIFY                 | pending/postedの異なるID、順不同イベント、削除・replayで二重計上やmanual category喪失が起きないこと                               |
| P32-RETRY      | 3.2   | Durable Retry / Background Jobs。同期はrequest内で実行。永続queue・retry状態の実装を確認できない                                                                                                                | P1       | TODO        | P32-STALE, P32-WEBHOOK              | process停止、timeout、rate limit、ページ取得中のmutationを含め、再開・backoff・idempotency・失敗隔離を実証                        |
| P32-WEBHOOK    | 3.2   | Webhook Error Handling。busy時429/retry header、失敗時500は実装済み。一方Item検索のDBエラーとunknown Itemをともに200 ignoredにしている                                                                          | P1       | IN PROGRESS | P32-STALE                           | transient DB障害とunknown/revoked Itemの区別、失敗記録自体の失敗、再送、HTTP応答を検証                                            |
| P32-SIGNATURE  | 3.2   | Webhook Signature / Payload Validation。ES256、JWT age、body hashは実装・fixture試験あり。JSONは型assertionで、runtime schema検証を確認できない。key cacheの期限管理も要確認                                    | P1       | IN PROGRESS | P01-LOG                             | 不正JSON、型・必須項目、algorithm/kid、future/expired token、hash形式、key失効・ローテーションを検証                              |
| P32-ISOLATION  | 3.2   | Sync-all Failure Isolation。loop内の1 Item失敗で409/500をreturnし、後続Itemを処理しない                                                                                                                         | P1       | TODO        | P32-STALE                           | 成功・失敗・busy混在の複数Itemで、失敗が他のItemを止めず、応答と件数が契約どおりであること                                        |
| P32-CONCURRENT | 3.2   | Concurrent Connection Tests。SQLには逐次stale-token試験があるが複数接続の実競合試験なし                                                                                                                         | P1       | TODO        | P31-VERIFY, P32-STALE, P32-ACCOUNTS | 独立DB接続で同一/別Itemの競合、lease失効、cursor進行、必要なLink/exchange同時接続ケースを実行                                     |
| P32-HTTP       | 3.2   | HTTP E2E。既存routeテストはhandler直接呼び出し＋依存mock                                                                                                                                                        | P1       | TODO        | P02-REPRO, P32-SIGNATURE            | 起動したNext.js→認証cookie→HTTP route→DBまでの成功/拒否/障害を隔離環境で検証                                                      |
| P32-CATEGORY   | 3.2   | Category Cross-User Integrity。通常RLSとmanual category actionは所有者確認あり。DBのcategory FKは単独IDで、service-role経路の複合所有権保証は未実証                                                             | P1       | IN PROGRESS | P02-REPRO, P32-WRITE                | 別ユーザーcategoryへのtransaction/budget参照を通常role・特権経路で検証し、DB制約と許可契約の整合性を確認                          |
| P32-INDEX      | 3.2   | Unique Index Review。transactionsにprovider ID単独とItem＋provider IDのUNIQUEが併存。categoriesに同じ列組のUNIQUE制約と別unique indexが存在                                                                     | P2       | TODO        | P02-REPRO                           | 実DBの制約・index、NULL semantics、provider ID範囲、ON CONFLICT先、重複indexコストを確認。削除は別途判断                          |
| P32-HOSTED     | 3.2   | Hosted Database Consistency。履歴上は確認済みだが現在のHosted schema・RLS・grant・RPCとの一致は未検証                                                                                                           | P1       | UNVERIFIED  | P02-REPRO                           | 対象環境を明示した読み取り専用比較でmigration history、関数、権限、index、生成型を照合し日時とcommitを保存                        |

根拠: [recordSyncFailure](../src/features/plaid/server/recordSyncFailure.ts)、[syncPlaidItem](../src/features/plaid/server/syncPlaidItem.ts)、[口座永続化](../src/features/plaid/server/persitstPlaidAccounts.ts)、[refresh route](../src/app/api/plaid/refresh-accounts/route.ts)、[sync-all](../src/app/api/plaid/sync-all/route.ts)、[Webhook](../src/app/api/plaid/webhook/route.ts)、[署名検証](../src/app/api/plaid/webhook/verifyWebhooks.ts)、[category action](../src/features/transactions/server-actions.ts)、[route tests](../tests/plaid-routes.test.ts)。

### Phase 5 — Implemented behavior

データフローは次のとおりです。UIが独自にDBへ問い合わせる構造ではありません。

```text
PostgreSQL / Supabase PostgREST
  → getSubscriptionTransactions(fromDate)
  → toTransactionInput()
  → detectSubscriptions()
  → SubscriptionCandidate[]
  → SubscriptionDashboard
```

| 報告された機能                       | コード確認結果と限界                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 最低3件・3連続月                     | 有効な3件を探索。入力全体の件数だけで判定しない                                                                              |
| 同日または月末                       | 3連続月の同じ日、または各月末を判定。年跨ぎ・うるう年テストあり                                                              |
| 金額変動±5%                          | 3件の**最初の支払額を基準**に±5%。中央値基準や全ペア間5%という意味ではない                                                   |
| account・merchant・currency grouping | merchantをtrim/lowercaseしたキーとaccount/currencyでgroup化                                                                  |
| Expenseのみ                          | 負の金額を対象。pending・removedは取得時とgroup化時に除外                                                                    |
| USD / CAD / JPY、minor units         | USD/CAD×100、JPY×1。非有限値・不正精度・safe integer外は変換で除外。unsupported currencyも除外                               |
| 候補金額                             | 選択した3件の絶対額の中央値。候補は正のminor units                                                                           |
| PostgreSQL adapter・pagination       | 認証ユーザーを取得しuser_idで絞り込み。500件単位のoffset pagination、posted_date/idの降順                                    |
| 認証                                 | `getUser()`で拒否し、protected layoutでもclaimsを確認。RLSの実環境動作確認とは別                                             |
| 検索期間                             | UTCの当月1日から6か月前を下限とする既存計算。直近180日固定ではない。取得に上限日はなく、future date方針も未定                |
| Dashboard                            | 通貨ごとの推定月額・件数、merchant、月次cadence、最終支払日。通貨換算・混在合計はしない                                      |
| Empty / Loading / Error              | 完全なEmpty State、route-level skeleton、client error boundaryの`reset()`。エラーを空配列に置き換えない                      |
| 表示・accessibility                  | monogram fallback、長いmerchant名の折返し、モバイル用配置、reduced-motion対応。SSRテストだけで視覚・操作品質全体は保証しない |
| 日付                                 | ISO日付をUTCで解釈しUTCで表示。4タイムゾーンの自動テストあり                                                                 |

### Phase 5 — Hardening backlog

下記12項目を従来どおり追跡します。既存機能を重複実装するための一覧ではなく、仕様・境界条件・検証の残件です。

| Task ID         | Phase | Description / 現在の根拠                                                                                                                                            | Priority | Status      | Dependencies                       | Verification requirements                                                                               |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| P05-RECENCY     | 5     | Recency and subscription activity estimation。過去のtripleがあれば候補になる。現在有効な契約とは判定できない                                                        | P1       | TODO        | P05-TRIPLE                         | 途絶・再開・直近支払い欠落・future dateを含む仕様とテスト。推測と確認済み状態を明確に分離               |
| P05-FALSEPOS    | 5     | False-positive reduction。同額の月次購入を契約と区別する根拠や評価データはない                                                                                      | P2       | TODO        | P05-RECENCY                        | 通常購入と定期課金の評価fixture、誤検知/見逃しの評価基準を定義。confidenceを確率として扱わない          |
| P05-TRIPLE      | 5     | Latest recurring triple selection。**月bucketを降順に探索する処理は既にある**。同じ最新window内の候補は日bucketの入力順等に依存し、複数windowの最新選択テストがない | P1       | IN PROGRESS | なし                               | 新旧の有効window、最新不成立、同月の複数候補、入力順変更について選択仕様・lastPaymentDate・決定性を検証 |
| P05-MERCHANT    | 5     | Merchant display name versus grouping key。group化時にlowercaseした値が候補の表示名にも流れる                                                                       | P2       | TODO        | なし                               | 表示名と正規化キーの契約、大文字小文字・空白・表記差・nullの扱いを定義して検証                          |
| P05-DUPLICATE   | 5     | Duplicate transaction protection。DBのUNIQUEはあるがDomainでIDによるdedupはない。取得時の重複・競合も未試験                                                         | P1       | IN PROGRESS | P32-INDEX, P05-PAGINATION          | 同じIDの繰返し、replay、別IDの同日支払いを区別し、候補金額・件数が不正に増えないこと                    |
| P05-MONEY       | 5     | Money correctness。minor-unit変換とmedianは実装済み。±5%境界、丸め、合算overflow等の全経路保証はない                                                                | P1       | IN PROGRESS | P04-FIN                            | DB numeric→JS number→minor units→推定合計の境界テストと許容誤差仕様。DB桁上限・safe integerも確認       |
| P05-CURRENCY    | 5     | Currency correctness。3通貨の変換・表示・別集計はテスト済み。通貨はaccountから取得しておりtransaction通貨との差異・unsupported除外の可視性は未整理                  | P1       | IN PROGRESS | P04-FIN                            | account/provider通貨の一致、欠落・非対応・非公式コードの方針、通貨混在非合算を確認                      |
| P05-PAGINATION  | 5     | Pagination correctness。500件offset＋二重sortは実装済み。実取得処理のページ境界テストなし                                                                           | P1       | IN PROGRESS | P02-REPRO                          | 0/499/500/501/1000件、同日、途中エラー、並行insert/removeで欠落・重複の契約を検証                       |
| P05-PERFORMANCE | 5     | Query performance。期間内全件をメモリに収集して検出。実測なし                                                                                                       | P2       | TODO        | P05-PAGINATION, P05-INDEX          | 代表件数でDB query、転送量、検出時間・メモリを計測し許容値を定義                                        |
| P05-INDEX       | 5     | Index design。既存user/date indexはあるがidを含むsortとpending/removed/amount条件への適合を実測していない                                                           | P2       | TODO        | P32-INDEX                          | 代表データのEXPLAIN計画・読み取りコストを確認し、書込みコストを含めindex方針を決定                      |
| P05-ERROR       | 5     | Error handling。例外伝播・generic error UIあり。取得例外にはDB error.messageを付加しており、server logの露出範囲も未検証                                            | P1       | IN PROGRESS | P01-LOG, P05-PAGINATION            | auth失敗・途中ページ失敗・不正行・再試行を検証し、emptyへの誤変換と機密露出がないこと                   |
| P05-AUTH        | 5     | Authentication and RLS verification。コード上の認証・user絞り込みはあり。実role/他ユーザーとの隔離テストなし                                                        | P1       | UNVERIFIED  | P02-REPRO, P32-WRITE, P32-CATEGORY | 未認証・期限切れ・別ユーザーの取引/口座、account joinを実DBで検証。service-roleの不用意な使用がないこと |

## 6. Open Issues and Technical Debt

### 履歴と現在の証拠の差分

1. **Phase 1は過去に120件成功と報告されているが、現在は全体テストが失敗する。** [server-boundaries.test.ts](../tests/server-boundaries.test.ts)のraw console禁止テストが`db.ts`で失敗した。さらに`syncPlaidItem.ts`にも直接console呼び出しがあり、cleanupログにはItem識別子と任意のerror messageを含む。実際の秘密漏洩を観測したわけではないが、従来のallowlist契約からの逸脱である。
2. **READMEと構成資料は現在の実装より古い。** [README](../README.md)の「専用テストスクリプトなし」「同期保存が非原子的」、[PROJECT_SUMMARY_MODIFIED](../PROJECT_SUMMARY_MODIFIED.md)の「migration/RLS定義なし」は現在のリポジトリと一致しない。ただしaccount snapshotまで原子的になったわけではない。本監査では既存文書を編集しない。
3. **migrationやSQLテストの存在は、現在のLocal/Hosted DBの一致を証明しない。** Phase 2適用成功、Phase 3.1統合成功、Netflix統合成功とcleanupは過去報告として保持する。
4. **最新triple探索は未実装ではない。** 降順month探索を確認したため、残件は選択仕様の精密化と回帰テストに限定して記述する。
5. **Positive UIの検証範囲を区別する。** 過去の会話には隔離HTML・fixtureによるdesktop/mobile previewの報告がある。しかし認証済み実ページ→実DBのPositive E2Eではない。「最新DashboardのPositive実データbrowser検証は未完了」という依頼文と矛盾しない。最新Empty State smoke成功も今回は再実行していない。
6. **Financial Correctnessはアプリ全体では未完了。** [summary SQL](../supabase/migrations/20261112000000_add_sync_lease_and_monthly_summary.sql)は通貨別groupを持たず、[formatValue](../src/lib/formatValue.ts)はCAD固定。dashboard/budget等のqueryはSubscriptionと同じpending除外方針に統一されていない。Subscription内の通貨分離を全機能へ一般化してはいけない。
7. **再現用設定に確認残件がある。** `supabase/config.toml`はseedを有効にして`./seed.sql`を参照するが、そのファイルは存在しない。これが実際の起動・migration検証へどう影響するかは未実行で、失敗すると断定しない。

### その他の未完了タスク

この表とPhase 3.2/5の表を未完了タスク台帳とします。依存関係は着手・完了の前提であり、今回実行する許可ではありません。

| Task ID     | Phase | Description                                                                     | Priority | Status     | Dependencies                                                 | Verification requirements                                                                                 |
| ----------- | ----- | ------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| P00-AUDIT   | 0     | 過去architecture auditの完了条件を照合し、古いREADME/構成資料の扱いを整理       | P2       | UNVERIFIED | 本文書レビュー                                               | source map・既存指摘・解消証拠を対応付け、文書差分の更新方針を承認                                        |
| P01-LOG     | 1     | 新しいPlaidログ経路を既存のsanitized logging契約へ戻す                          | P0       | TODO       | 本文書レビュー                                               | raw-console禁止テスト、機密sentinelテスト、全体Vitestの合格。テストを弱めて回避しない                     |
| P01-RECHECK | 1     | dependency/security buildの過去成功を現commitで再検証                           | P1       | UNVERIFIED | P01-LOG                                                      | lockfileに対するaudit、隔離security build、client secret scanとnegative import試験の結果を保存            |
| P02-REPRO   | 2     | Local DB再現性、seed設定、migration適用手順の再確認                             | P1       | UNVERIFIED | 対象DB・実行範囲の明示と承認                                 | 隔離DBで3本のmigration、schema/権限/関数、seed有無の契約を再現し、結果を保存                              |
| P31-VERIFY  | 3.1   | 11項目のatomic SQL統合テストの現commit再検証                                    | P1       | UNVERIFIED | P02-REPRO                                                    | 指定された空の隔離DBのみで実行し11項目成功とrollback後fixture不在を確認。今回は禁止範囲                   |
| P04-FIN     | 4     | 全機能の符号、通貨、精度、pending/removed、日付期間、返金・移動の会計ルール整理 | P1       | TODO       | 本文書レビュー                                               | dashboard/transaction/budget/account/Subscriptionに共通の入力fixtureと期待値を定義し、一致を検証          |
| P05-E2E     | 5     | 最新Subscriptionページの認証付きPositive/Empty/Loading/Error browser検証        | P1       | UNVERIFIED | P02-REPRO, P05-AUTH, P05-ERROR                               | デスクトップ/モバイル、実取得経路、3通貨、長い名前、overflow、keyboard/retry、fixture cleanupの証拠を保存 |
| P06-AI      | 6     | AI Insightsの要件・評価・データ利用境界を定義                                   | P3       | TODO       | P04-FIN, P05-RECENCY                                         | 入力の信頼性、説明根拠、誤回答、privacy/costを評価してから公開判断                                        |
| P07-RELEASE | 7     | リリース基準・環境分離・Subscription公開可否を決定                              | P1       | TODO       | P01-LOG, P01-RECHECK, P32-HOSTED, P32-HTTP, P04-FIN, P05-E2E | 未解決リスク承認、production build、環境確認、デプロイSHA/結果、smoke、rollback計画。guard変更は独立判断  |
| P08-INFRA   | 8     | AWS / Terraformの必要性と構成を検討                                             | P3       | TODO       | P07-RELEASEの運用要件                                        | 現Vercel運用との役割、state管理、権限、費用、再現・破棄・復旧手順を検証                                   |
| P09-CI      | 9     | CI/CDの実行ゲートを整備                                                         | P2       | TODO       | P01-LOG, P02-REPRO                                           | 型・lint・unit・隔離DB統合・buildを自動実行し、失敗でreleaseを止める。秘密管理と承認経路も確認            |
| P10-OBS     | 10    | 監視・計測・アラートとSLOを整備                                                 | P2       | TODO       | P01-LOG, P32-RETRY                                           | sync遅延/失敗、DB障害、retry滞留を検知し、機密値なしで原因追跡できること                                  |
| P11-IR      | 11    | インシデント対応・復旧・credential rotationの手順を作成                         | P2       | TODO       | P07-RELEASE, P10-OBS                                         | DB復旧、誤同期、認証/秘密情報事故の演習を実施し、担当と復旧目標を記録                                     |
| MAINT-LINT  | 0     | 既存lint warning 5件の整理                                                      | P2       | TODO       | 本文書レビュー                                               | root font link、unused `_day` 2件、budget catch変数2件を別作業で整理しlintを確認                          |

## 7. Verification Matrix

すべての「今回実行」は2026-11-22の上記HEADに対する結果です。失敗結果も進捗の証拠として保持します。

| 対象 / コマンド                                                    | 証拠区分                 | 結果                                                          | 状態 / 限界                                                                            |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `git status --short` / branch / HEAD / log -8                      | 今回実行                 | 開始時clean、branch/commitはSection 2記載                     | DONE：ローカルcheckoutの確認のみ                                                       |
| `npx --no-install vitest run src/features/subscriptions/__tests__` | 今回実行                 | 9 files / **84 passed**                                       | DONE：65 original＋19 UI/formatting。DB・HTTP実接続なし                                |
| `npm test`                                                         | 今回実行                 | 14 files passed / 1 failed。**203 passed / 1 failed**         | TODO：`P01-LOG`。失敗はraw console禁止の1件                                            |
| `npm run typecheck`                                                | 今回実行                 | exit 0                                                        | DONE：`--noEmit --incremental false`で既存build infoを書き換えない                     |
| `npm run lint`                                                     | 今回実行                 | exit 0、0 errors / 5 warnings                                 | DONE：warning残件は`MAINT-LINT`                                                        |
| Phase 1 security build・dependency audit                           | 過去報告                 | security-baseline.mdは成功・脆弱性0を報告                     | UNVERIFIED：現在の再実行結果ではない。公開時点で再確認が必要                           |
| Phase 2 Local/Hosted migration適用                                 | 過去報告＋コード確認     | 3本のmigrationあり。適用成功は依頼文の報告                    | UNVERIFIED：DB未接続、drift未比較                                                      |
| Phase 3.1 SQL integration                                          | 過去報告＋テスト定義確認 | 11ケースの再現可能なSQLファイルあり。過去に主要試験成功と報告 | UNVERIFIED：INSERT/UPDATEを行うため、rollback設計でも今回の実行対象外                  |
| Netflix Local DB positive integration                              | 過去報告                 | 月次3件から1候補を検出したとの報告                            | UNVERIFIED：現在のDB/commitで再現していない。専用Subscription DB統合テストは確認できず |
| Netflix temporary data cleanup                                     | 過去報告                 | cleanup済みとの報告                                           | UNVERIFIED：今回DBを照会していない                                                     |
| Latest Empty State smoke                                           | 過去報告                 | 成功との報告                                                  | UNVERIFIED：今回browser起動・再実行なし                                                |
| Isolated UI fixture browser preview                                | 過去の会話の報告         | 複数幅・各UI状態のpreview成功                                 | UNVERIFIED：今回未再実行。認証・DB・実route E2Eを代替しない                            |
| 最新Positive UIの実データbrowser E2E                               | 未検証                   | 完了証拠なし                                                  | UNVERIFIED：`P05-E2E`                                                                  |
| Hosted auth/RLS、並行接続、HTTP E2E                                | コード確認のみ           | 関連実装・mock testsはある                                    | UNVERIFIED：`P05-AUTH`、`P32-CONCURRENT`、`P32-HTTP`                                   |
| `git diff --check`、新規文書のwhitespace/変更範囲確認              | 今回実行                 | 本文書のみ追加、既存ファイル不変、whitespaceエラーなし        | DONE：未追跡の新規文書も別途検査                                                       |

[test setup](../tests/setup.ts)は合成設定を使用しfetch/HTTP/socketアクセスを拒否します。[Vitest config](../vitest.config.mts)はNode環境で`.test.ts`を収集します。route testsのmockやSQLファイルを読み取るだけの確認を、実際の認証・RLS・HTTP検証と数えません。

## 8. Environment and Deployment Status

環境ファイルは値を出力せず、存在、キーの有無、接続先の分類、Git ignoreだけを確認しました。URL、project reference、credential値は本書へ記録しません。

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

次の5件を優先候補とします。**本文書のレビュー後に別途着手する作業**であり、今回実装は進めません。各IDの状態・依存・完了検証は上の台帳を参照してください。

1. **P01-LOG** — raw consoleによるセキュリティ回帰を修正し、全204件のテストを合格へ戻す。
2. **P32-WRITE** — authenticated roleが直接変更できる列の契約を定義し、金融データ・同期metadataの書込み境界を検証する。
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

Phase 5完了には実装だけでなく12項目のHardeningと`P05-E2E`の解決、または明示された仕様上の除外・リスク承認が必要です。Phase 7完了には公開判断、対応するdeployment証拠、smoke、監視・rollback責任が必要です。開発専用guardの解除は自動的な後続作業ではありません。

今回の文書作成自体の完了条件は、11セクション・全ロードマップ・13＋12の残件・検証区分を満たし、本ファイル以外が不変であることです。プロジェクトの実装完了を意味しません。

## 11. Change Log

| Date（America/Vancouver） | 対象                 | 変更 / 証拠                                                                                                                                                                        |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22                | 初回監査 / `ac0cece` | roadmapを維持して進捗台帳を新規作成。開始時working treeはclean                                                                                                                     |
| 2026-11-22                | Phase 5              | Subscription 84件成功を再確認。Domain/Adapter/UI実装とhardening残件を分離                                                                                                          |
| 2026-11-22                | Phase 1 / 全体検証   | 全体204件中1件失敗を新規記録。TypeScript成功、lint 0 errors / 5 warnings。修正は未実施                                                                                             |
| 2026-11-22                | 環境・証拠の整理     | Local/Hosted設定の分類を値非公開で確認。DB試験・cleanup・smokeの過去報告を独立検証と区別                                                                                           |
| 2026-11-22                | 文書検証             | ファイル存在、内部リンク、11見出し、固定Task ID、13＋12の残件、次の5件を確認。`git diff --check`と新規文書のwhitespace検査を通過。最終statusは本ファイルのみ追加、既存ファイル不変 |

## 2026-11-22 — Follow-up Verification

Branch: feat/subscription-detection
Status: Uncommitted changes verified

### Verification

- Full Vitest: 209/209 PASS (15 files)
- Subscription: 89/89 PASS
- TypeScript: PASS
- ESLint: 0 errors / 5 existing warnings
- git diff --check: PASS

### P01-LOG — DONE

- Removed raw console calls from Plaid sync helpers.
- Reused allowlisted sanitized logging.
- Preserved error propagation and lease cleanup behavior.
- Security boundary and logger tests passed.
- Full regression suite passed.

### P05-TRIPLE — IN PROGRESS

- Latest valid three-month window selection verified.
- Latest payment date prioritized within a window.
- Month-end patterns prioritized.
- Same-amount transaction ties sorted by ID.
- Fourteen findRecurringTriple tests passed.
- Remaining: verify combinations involving multiple
  amount candidates inside the allowed tolerance.

### Remaining

- Actual DB concurrency behavior not reverified.
- Production security and deployment not verified.
- Existing lint warnings remain.
