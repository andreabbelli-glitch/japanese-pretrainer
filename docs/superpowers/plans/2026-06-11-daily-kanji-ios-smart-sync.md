# Daily Kanji iOS Smart Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Daily Kanji iOS offline-first: the app refreshes the ranked study dataset from a private web endpoint when useful, while the widget stays network-free and reads a shared local cache.

**Architecture:** Keep the packaged JSON/audio bundle as a fallback. Add a private Next.js API that reuses `buildDailyKanjiDataset`; add an iOS App Group cache read by both app and widget; add an app-only sync client with a 4-hour/day-change/manual refresh policy.

**Tech Stack:** Next.js App Router route handlers, Vitest, SwiftUI, WidgetKit, XcodeGen, XCTest.

---

## File Structure

- `src/app/api/daily-kanji/ios-dataset/route.ts`: private dataset endpoint.
- `tests/daily-kanji-ios-dataset-route.test.ts`: route auth/cache/status tests.
- `apps/daily-kanji-ios/project.yml`: App Group entitlements and generated config files.
- `apps/daily-kanji-ios/App/DailyKanji.entitlements`: app App Group entitlement.
- `apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.entitlements`: widget App Group entitlement.
- `apps/daily-kanji-ios/Shared/DailyKanjiCacheStore.swift`: shared JSON cache paths, metadata, atomic writes.
- `apps/daily-kanji-ios/Shared/DailyKanjiRepository.swift`: loading order shared cache -> bundle -> sample.
- `apps/daily-kanji-ios/Shared/DailyKanjiSyncPolicy.swift`: 4-hour/day-change/backoff decision logic.
- `apps/daily-kanji-ios/App/DailyKanjiSyncClient.swift`: app-only `URLSession` dataset fetch.
- `apps/daily-kanji-ios/App/DailyKanjiAppModel.swift`: async sync orchestration and UI state.
- `apps/daily-kanji-ios/App/ContentView.swift`: sync status and manual refresh control.
- `apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.swift`: repository call uses shared cache.
- `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`: cache/repository/sync policy/model tests.
- `tests/daily-kanji-ios-offline-contract.test.ts`: evolve offline-only contract into offline-first contract.
- `apps/daily-kanji-ios/offline-contract.json`: update runtime budget and entitlement expectations.
- `.env.example`: document `DAILY_KANJI_IOS_SYNC_TOKEN`.
- `apps/daily-kanji-ios/README.md` and `docs/local-verification-notes.md`: user runbook and QA notes.

## Task 1: App Group Signing And Contract

**Files:**
- Modify: `apps/daily-kanji-ios/project.yml`
- Create: `apps/daily-kanji-ios/App/DailyKanji.entitlements`
- Create: `apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.entitlements`
- Modify: `apps/daily-kanji-ios/offline-contract.json`
- Modify: `tests/daily-kanji-ios-offline-contract.test.ts`

- [ ] **Step 1: Write the contract expectation**

Update `tests/daily-kanji-ios-offline-contract.test.ts` so it expects:

```ts
expect(contract.entitlements).toEqual({
  appGroups: true,
  associatedDomains: false
});
expect(contract.runtimeNetwork).toBe("offline-first");
expect(contract.freeTierBudget.monthlyRuntime.vercelRequests).toBeLessThanOrEqual(200);
expect(contract.freeTierBudget.monthlyRuntime.tursoQueries).toBeLessThanOrEqual(200);
```

Also split runtime-network scanning by target:

```ts
const appSourceDirs = ["App", "Shared"].map((segment) => path.join(iosRoot, segment));
const widgetSourceDirs = ["WidgetExtension"].map((segment) => path.join(iosRoot, segment));
```

`URLSession` and `URLRequest` are allowed in `App`, but still forbidden in `WidgetExtension`.

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```sh
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-offline-contract.test.ts
```

Expected: FAIL because App Group entitlements and the updated contract are not present.

- [ ] **Step 3: Add App Group entitlements**

Add `CODE_SIGN_ENTITLEMENTS` to both XcodeGen targets:

```yaml
DailyKanji:
  settings:
    base:
      CODE_SIGN_ENTITLEMENTS: App/DailyKanji.entitlements

DailyKanjiWidgetExtension:
  settings:
    base:
      CODE_SIGN_ENTITLEMENTS: WidgetExtension/DailyKanjiWidget.entitlements
```

Create both entitlement files with the same group:

```xml
<key>com.apple.security.application-groups</key>
<array>
  <string>group.dev.local.daily-kanji</string>
</array>
```

- [ ] **Step 4: Update contract JSON**

Set:

```json
{
  "runtimeNetwork": "offline-first",
  "entitlements": {
    "appGroups": true,
    "associatedDomains": false
  },
  "remoteServices": ["private-daily-kanji-ios-dataset-api"]
}
```

Monthly runtime budget should state app sync only, widget zero network, and a default maximum of 200 Vercel requests / 200 Turso export queries per month.

- [ ] **Step 5: Verify generated project and signing**

Run:

```sh
cd apps/daily-kanji-ios
xcodegen generate
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/AppGroupProbeDerivedData build
```

Expected: PASS. If provisioning fails specifically on App Groups with Personal Team, stop this task and implement the documented fallback path in a revised plan before continuing.

- [ ] **Step 6: Run verification**

Run:

```sh
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-offline-contract.test.ts
cd apps/daily-kanji-ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

- [ ] **Step 7: Independent reviews and commit**

Run spec-compliance review and code-quality review. Repeat fixes until both are green.

Commit:

```sh
git add apps/daily-kanji-ios/project.yml apps/daily-kanji-ios/App/DailyKanji.entitlements apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.entitlements apps/daily-kanji-ios/offline-contract.json tests/daily-kanji-ios-offline-contract.test.ts
git commit -m "Enable Daily Kanji iOS shared cache entitlement"
git push
```

## Task 2: Private Dataset API

**Files:**
- Create: `src/app/api/daily-kanji/ios-dataset/route.ts`
- Create: `tests/daily-kanji-ios-dataset-route.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing route tests**

Create tests that import `GET` from the route and assert:

```ts
expect(response.status).toBe(503); // token missing
expect(response.status).toBe(401); // wrong bearer token
expect(response.headers.get("cache-control")).toContain("no-store");
expect(body.version).toBe(1);
expect(Array.isArray(body.cards)).toBe(true);
```

Use `withTestDatabase` and a temporary `DATABASE_URL` so the route reads a known DB.

- [ ] **Step 2: Run tests and verify failure**

Run:

```sh
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-dataset-route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

The route must:

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuredSecret = process.env.DAILY_KANJI_IOS_SYNC_TOKEN?.trim();
  const providedSecret = parseBearerToken(request.headers.get("authorization"));
  // 503 missing secret, 401 mismatch, then buildDailyKanjiDataset({ database: db })
}
```

Use `matchesSecret` and return `NextResponse.json(dataset, { headers: { "Cache-Control": "private, no-store" } })`.

- [ ] **Step 4: Document env var**

Add to `.env.example`:

```dotenv
# Private bearer token used by the personal Daily Kanji iOS app to refresh its dataset.
DAILY_KANJI_IOS_SYNC_TOKEN=
```

- [ ] **Step 5: Verify**

Run:

```sh
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-dataset-route.test.ts tests/daily-kanji-export.test.ts
./scripts/with-node.sh pnpm check
```

- [ ] **Step 6: Independent reviews and commit**

Run reviewer loop until green.

Commit:

```sh
git add src/app/api/daily-kanji/ios-dataset/route.ts tests/daily-kanji-ios-dataset-route.test.ts .env.example
git commit -m "Add private Daily Kanji iOS dataset endpoint"
git push
```

## Task 3: Shared Cache Repository

**Files:**
- Create: `apps/daily-kanji-ios/Shared/DailyKanjiCacheStore.swift`
- Modify: `apps/daily-kanji-ios/Shared/DailyKanjiRepository.swift`
- Modify: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

- [ ] **Step 1: Add failing cache tests**

Add XCTest cases:

```swift
func testRepositoryPrefersSyncedSharedCacheOverBundle() throws {
    // bundle contains cards ["hard", "stable"], shared cache contains ["card-0"]
    // expected: DailyKanjiRepository.loadCards().map(\.cardId) == ["card-0"]
}

func testRepositoryFallsBackToBundleWhenSharedCacheIsInvalid() throws {
    // shared cache contains invalid JSON, bundle contains cards ["hard", "stable"]
    // expected: DailyKanjiRepository.loadCards().map(\.cardId) == ["hard", "stable"]
}

func testCacheStoreWritesDatasetAtomicallyWithMetadata() throws {
    // write a one-card dataset at fixed Date(timeIntervalSince1970: 1_800_000_000)
    // expected: loadDataset()?.cards.map(\.cardId) == ["card-0"]
    // expected: loadMetadata()?.cardCount == 1
}
```

Use temporary directories with `FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)`.

- [ ] **Step 2: Run iOS tests and verify failure**

Run:

```sh
cd apps/daily-kanji-ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

Expected: FAIL because cache store APIs are missing.

- [ ] **Step 3: Implement cache store**

Create:

```swift
struct DailyKanjiCachedDatasetMetadata: Codable, Equatable {
    let cachedAt: Date
    let generatedAt: String
    let cardCount: Int
}

struct DailyKanjiCacheStore {
    static let appGroupIdentifier = "group.dev.local.daily-kanji"
    func loadDataset() -> DailyKanjiDataset?
    func loadMetadata() -> DailyKanjiCachedDatasetMetadata?
    func write(dataset: DailyKanjiDataset, cachedAt: Date) throws
}
```

Use `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` for production and an injected directory for tests. Write to temporary files, then replace/move into `daily-kanji-cards.json` and `daily-kanji-cache-metadata.json`.

- [ ] **Step 4: Update repository loading order**

`DailyKanjiRepository.loadCards()` should load:

1. `cacheStore.loadDataset()?.cards` when non-empty;
2. bundled `daily-kanji-cards.json`;
3. sample card.

Also expose lightweight load metadata for UI:

```swift
func loadDatasetSource() -> DailyKanjiDatasetSource
```

- [ ] **Step 5: Verify**

Run:

```sh
cd apps/daily-kanji-ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

- [ ] **Step 6: Independent reviews and commit**

Run reviewer loop until green.

Commit:

```sh
git add apps/daily-kanji-ios/Shared/DailyKanjiCacheStore.swift apps/daily-kanji-ios/Shared/DailyKanjiRepository.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "Read Daily Kanji iOS dataset from shared cache"
git push
```

## Task 4: App Sync Client And Policy

**Files:**
- Create: `apps/daily-kanji-ios/Shared/DailyKanjiSyncPolicy.swift`
- Create: `apps/daily-kanji-ios/App/DailyKanjiSyncClient.swift`
- Modify: `apps/daily-kanji-ios/App/DailyKanjiAppModel.swift`
- Modify: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

- [ ] **Step 1: Add failing policy tests**

Add XCTest cases:

```swift
func testSyncPolicyRefreshesWhenCacheIsOlderThanFourHours() {
    // metadata.cachedAt = now - 4h - 1s
    // expected: shouldSync(now: now, metadata: metadata, lastFailureAt: nil, force: false) == true
}

func testSyncPolicyRefreshesAfterCalendarDayChange() {
    // metadata.cachedAt = 2026-06-10T23:30:00Z, now = 2026-06-11T00:05:00Z
    // expected: shouldSync(now: now, metadata: metadata, lastFailureAt: nil, force: false) == true
}

func testSyncPolicyBacksOffAfterFailure() {
    // lastFailureAt = now - 14m, no force
    // expected: shouldSync(now: now, metadata: metadata, lastFailureAt: lastFailureAt, force: false) == false
    // expected: shouldSync(now: now, metadata: metadata, lastFailureAt: lastFailureAt, force: true) == true
}
```

- [ ] **Step 2: Add failing model/client tests**

Use a mock sync service protocol:

```swift
protocol DailyKanjiSyncing {
    func fetchDataset() async throws -> DailyKanjiDataset
}
```

Assert that a successful manual refresh updates `cards`, selected card, metadata, and calls a reload hook.

- [ ] **Step 3: Run iOS tests and verify failure**

Run the simulator XCTest command.

- [ ] **Step 4: Implement sync policy**

Create:

```swift
struct DailyKanjiSyncPolicy {
    let refreshInterval: TimeInterval = 4 * 60 * 60
    let failureBackoff: TimeInterval = 15 * 60
    func shouldSync(now: Date, metadata: DailyKanjiCachedDatasetMetadata?, lastFailureAt: Date?, force: Bool) -> Bool
}
```

Use `Calendar(identifier: .gregorian)` to detect day changes from `metadata.cachedAt` to `now`.

- [ ] **Step 5: Implement app sync client**

Create `DailyKanjiSyncClient` using `URLSession.shared.data(for:)`.

Configuration should come from `DailyKanjiSyncConfiguration`:

```swift
struct DailyKanjiSyncConfiguration {
    let endpointURL: URL?
    let bearerToken: String?
    static func load(bundle: Bundle = .main) -> DailyKanjiSyncConfiguration
}
```

Load values from Info.plist keys `DAILY_KANJI_IOS_SYNC_ENDPOINT` and `DAILY_KANJI_IOS_SYNC_TOKEN`. Missing config means sync unavailable, not app failure.

- [ ] **Step 6: Orchestrate in app model**

Add `@Published` sync state:

```swift
enum DailyKanjiSyncState: Equatable {
    case unavailable
    case idle(source: DailyKanjiDatasetSource)
    case syncing(source: DailyKanjiDatasetSource)
    case failed(message: String, source: DailyKanjiDatasetSource)
}
```

On app activation, start an unstructured `Task` only when policy says sync is due. Manual refresh forces sync.

- [ ] **Step 7: Verify**

Run:

```sh
cd apps/daily-kanji-ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-offline-contract.test.ts
```

- [ ] **Step 8: Independent reviews and commit**

Run reviewer loop until green.

Commit:

```sh
git add apps/daily-kanji-ios/Shared/DailyKanjiSyncPolicy.swift apps/daily-kanji-ios/App/DailyKanjiSyncClient.swift apps/daily-kanji-ios/App/DailyKanjiAppModel.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "Sync Daily Kanji iOS dataset on app activation"
git push
```

## Task 5: Widget Shared Cache And Sync UI

**Files:**
- Modify: `apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.swift`
- Modify: `apps/daily-kanji-ios/App/ContentView.swift`
- Modify: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`
- Modify: `tests/daily-kanji-ios-offline-contract.test.ts`

- [ ] **Step 1: Add widget/cache contract assertions**

Assert widget source files still do not contain:

```ts
/\bURLSession\b/,
/\bURLRequest\b/,
/\bData\s*\(\s*contentsOf:\s*URL\s*\(/
```

but shared local file reads remain allowed.

- [ ] **Step 2: Update widget provider**

Ensure `KanjiProvider` constructs `DailyKanjiRepository()` with the shared cache default and does not introduce networking.

- [ ] **Step 3: Add sync UI**

Add a compact top status row to `ContentView`:

- source: `Sincronizzato`, `Bundle`, or `Cache non aggiornata`;
- last sync time when present;
- button `Aggiorna ora`;
- disabled/progress state while syncing.

- [ ] **Step 4: Verify**

Run:

```sh
./scripts/with-node.sh pnpm test tests/daily-kanji-ios-offline-contract.test.ts
cd apps/daily-kanji-ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

- [ ] **Step 5: Independent reviews and commit**

Run reviewer loop until green.

Commit:

```sh
git add apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.swift apps/daily-kanji-ios/App/ContentView.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift tests/daily-kanji-ios-offline-contract.test.ts
git commit -m "Surface Daily Kanji iOS sync status"
git push
```

## Task 6: Docs, Full Verification, Device QA

**Files:**
- Modify: `apps/daily-kanji-ios/README.md`
- Modify: `docs/local-verification-notes.md`
- Modify: `.env.example` if Task 2 did not already document all iOS keys.

- [ ] **Step 1: Update runbook**

Document:

```sh
DAILY_KANJI_IOS_SYNC_ENDPOINT=https://<deployment>/api/daily-kanji/ios-dataset
DAILY_KANJI_IOS_SYNC_TOKEN=<secret>
```

and clarify:

- app syncs on launch/foreground at most every 4 hours;
- manual refresh is available;
- widget reads cache written by app;
- bundled snapshot remains fallback;
- audio is still bundled-only.

- [ ] **Step 2: Full web verification**

Run:

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

Expected: PASS.

- [ ] **Step 3: Full iOS simulator verification**

Run:

```sh
cd apps/daily-kanji-ios
./scripts/doctor.sh
xcodegen generate
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

Expected: PASS.

- [ ] **Step 4: Device QA**

Run:

```sh
./scripts/with-node.sh pnpm daily-kanji:package
cd apps/daily-kanji-ios
./scripts/xcode-renew.sh
```

Manual checks on iPhone:

- app opens with current dataset;
- manual refresh succeeds when endpoint/token are configured;
- lock-screen widget shows synced cards after app refresh;
- home widget still works;
- audio button remains enabled only for bundled audio;
- offline mode still shows cached or bundled data.

- [ ] **Step 5: Independent final review and commit**

Run final reviewer loop until green.

Commit:

```sh
git add apps/daily-kanji-ios/README.md docs/local-verification-notes.md .env.example
git commit -m "Document Daily Kanji iOS smart sync workflow"
git push
```
