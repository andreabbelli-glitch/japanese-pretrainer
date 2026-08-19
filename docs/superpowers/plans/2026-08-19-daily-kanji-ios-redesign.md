# Daily Kanji iOS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Daily Kanji iOS app around the approved `Widget · Ripasso · Cerca` information architecture while preserving widget, offline cache, sync, review, and deep-link contracts.

**Architecture:** Replace the monolithic `ContentView` with a small `TabView` shell and feature-owned SwiftUI roots. Keep `DailyKanjiAppModel` as the tested domain coordinator, move presentation logic and copy into testable types, and keep only ephemeral state inside views.

**Tech Stack:** Swift 5.10, SwiftUI, Combine, WidgetKit, AVFoundation, XCTest, XcodeGen, iOS 17+

**Spec:** `docs/superpowers/specs/2026-08-19-daily-kanji-ios-redesign-design.md`

## Global Constraints

- Navigation labels are exactly `Widget`, `Ripasso`, and `Cerca`.
- User-facing study modes are `Giornaliero`, `Prestudio`, and `Ultime 3`.
- User-facing FSRS ratings are `Di nuovo`, `Difficile`, `Bene`, and `Facile`.
- Keep iOS deployment target `17.0` and Swift version `5.10`.
- Use system fonts, semantic colors, SF Symbols, and minimum 44×44 pt controls.
- Preserve App Group scope persistence, atomic draft/apply semantics, timeline reload behavior, offline fallback, and `dailykanji://card/...` deep links.
- Do not modify `WidgetExtension/DailyKanjiWidget.swift` unless a verified compatibility failure requires it.
- Do not persist or display endpoint/token values.
- Do not stage unrelated workspace changes.

## File Structure

```text
apps/daily-kanji-ios/App/
  ContentView.swift                                  # small app shell only
  DesignSystem/
    DailyKanjiDesign.swift                          # spacing, surface and toolbar primitives
  Features/
    Widget/
      DailyKanjiWidgetHomeView.swift                # Widget tab root and navigation
      DailyKanjiWidgetCardView.swift                # current card and rationale disclosure
      DailyKanjiWidgetSheets.swift                  # scope editor and history
    Review/
      DailyKanjiReviewHomeView.swift                # Ripasso root and states
      DailyKanjiReviewCardView.swift                # reveal, answer and FSRS grading
    Search/
      DailyKanjiGlossaryHomeView.swift              # searchable list
      DailyKanjiGlossaryDetailView.swift            # pushed detail
    Settings/
      DailyKanjiSettingsView.swift                  # centralized settings/status Form
  Presentation/
    DailyKanjiPresentations.swift                   # tab/copy/status/formatting projections
```

`project.yml` already includes `App` recursively, so new Swift files require no source-list change.

---

### Task 1: Navigation vocabulary and presentation foundation

**Files:**
- Create: `apps/daily-kanji-ios/App/Presentation/DailyKanjiPresentations.swift`
- Modify: `apps/daily-kanji-ios/App/DailyKanjiAppModel.swift`
- Modify: `apps/daily-kanji-ios/App/ContentView.swift`
- Modify: `apps/daily-kanji-ios/App/DailyKanjiLiveReviewClient.swift`
- Modify: `apps/daily-kanji-ios/Shared/DailyKanjiModels.swift`
- Test: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

**Interfaces:**
- Produces: `DailyKanjiAppTab`, `DailyKanjiAppModel.selectedTab`, `DailyKanjiAppModel.selectTab(_:now:)`.
- Produces: internal display properties for glossary entries, study modes, SRS values, review ratings, sync status, and review status.
- Preserves: model behavior and deep-link routing; only names and presentation ownership change.

- [ ] **Step 1: Add failing vocabulary and deep-link tests**

```swift
func testAppTabsUseApprovedItalianVocabulary() {
    XCTAssertEqual(DailyKanjiAppTab.allCases.map(\.label), ["Widget", "Ripasso", "Cerca"])
    XCTAssertEqual(DailyKanjiStudyMode.allCases.map(\.label), ["Giornaliero", "Prestudio", "Ultime 3"])
    XCTAssertEqual(
        DailyKanjiLiveReviewRating.reviewDisplayOrder.map(\.label),
        ["Facile", "Bene", "Difficile", "Di nuovo"]
    )
}

func testCardDeepLinkSelectsWidgetTab() throws {
    let card = try XCTUnwrap(
        try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards.first
    )
    let model = DailyKanjiAppModel(cards: [card])
    model.selectTab(.search)
    model.openDeepLink(DailyKanjiDeepLink.cardURL(cardId: card.cardId))
    XCTAssertEqual(model.selectedTab, .widget)
}
```

- [ ] **Step 2: Run the iOS test suite and confirm the new tests fail**

Run:

```bash
DAILY_KANJI_IOS_TEST_DESTINATION='platform=iOS Simulator,id=8D2F3E35-D0E3-4E7E-970E-9829A5A89FAC' \
  ./scripts/with-node.sh pnpm daily-kanji:test
```

Expected: compile/test failure because `DailyKanjiAppTab`, `selectedTab`, and the Italian labels do not exist yet.

- [ ] **Step 3: Introduce the approved tab API and move presentation-only extensions**

```swift
enum DailyKanjiAppTab: String, CaseIterable, Identifiable {
    case widget
    case review
    case search

    var id: String { rawValue }

    var label: String {
        switch self {
        case .widget: "Widget"
        case .review: "Ripasso"
        case .search: "Cerca"
        }
    }

    var systemImage: String {
        switch self {
        case .widget: "rectangle.stack"
        case .review: "rectangle.stack.badge.play"
        case .search: "magnifyingglass"
        }
    }
}
```

Rename `selectedAppSection` to `selectedTab`, `selectAppSection` to `selectTab`, `.daily` to `.widget`, and `.glossary` to `.search` throughout app and tests. Move the existing glossary/card/status/rating presentation extensions from `ContentView.swift` into `DailyKanjiPresentations.swift`, removing `private` where tests or feature files consume them.

- [ ] **Step 4: Translate presentation copy without changing wire values**

Keep enum raw values (`again`, `hard`, `good`, `easy`, `daily`, `prestudy`, `last3`) unchanged. Change display properties only:

```swift
extension DailyKanjiLiveReviewRating {
    static let reviewDisplayOrder: [Self] = [.easy, .good, .hard, .again]

    var label: String {
        switch self {
        case .again: "Di nuovo"
        case .hard: "Difficile"
        case .good: "Bene"
        case .easy: "Facile"
        }
    }
}
```

- [ ] **Step 5: Run the full iOS tests and commit the foundation**

Run the command from Step 2. Expected: PASS.

```bash
git add apps/daily-kanji-ios/App apps/daily-kanji-ios/Shared/DailyKanjiModels.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "refactor(ios): establish app navigation vocabulary"
```

---

### Task 2: Design system and Widget feature

**Files:**
- Create: `apps/daily-kanji-ios/App/DesignSystem/DailyKanjiDesign.swift`
- Create: `apps/daily-kanji-ios/App/Features/Widget/DailyKanjiWidgetHomeView.swift`
- Create: `apps/daily-kanji-ios/App/Features/Widget/DailyKanjiWidgetCardView.swift`
- Create: `apps/daily-kanji-ios/App/Features/Widget/DailyKanjiWidgetSheets.swift`
- Modify: `apps/daily-kanji-ios/App/ContentView.swift`
- Test: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

**Interfaces:**
- Consumes: `DailyKanjiAppModel`, `DailyKanjiAudioPlayer`, presentation extensions from Task 1.
- Produces: `DailyKanjiWidgetHomeView(model:openSettings:)`.
- Produces: `DailyKanjiSettingsToolbarButton(action:)` and `DailyKanjiCardSurface`.

- [ ] **Step 1: Add failing source-contract tests for the new Widget structure**

```swift
func testWidgetHomeUsesProgressiveDisclosureAndScopeSheet() throws {
    let source = try Self.appSourceFileContents(
        relativePath: "Features/Widget/DailyKanjiWidgetHomeView.swift"
    )
    XCTAssertTrue(source.contains("Percorso widget"))
    XCTAssertTrue(source.contains("Perché questa scheda"))
    XCTAssertTrue(source.contains("Recenti"))
    XCTAssertFalse(source.contains("Sync non configurato"))
}
```

Add a reusable helper:

```swift
private static func appSourceFileContents(relativePath: String) throws -> String {
    let url = projectURL
        .appendingPathComponent("App")
        .appendingPathComponent(relativePath)
    return try String(contentsOf: url, encoding: .utf8)
}
```

- [ ] **Step 2: Run tests and confirm the source file is missing**

Run the Task 1 test command. Expected: FAIL because the Widget feature files do not exist.

- [ ] **Step 3: Implement shared native visual primitives**

```swift
enum DailyKanjiDesign {
    static let pageInset: CGFloat = 20
    static let sectionSpacing: CGFloat = 24
    static let surfaceRadius: CGFloat = 20
}

struct DailyKanjiCardSurface<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: DailyKanjiDesign.surfaceRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: DailyKanjiDesign.surfaceRadius, style: .continuous)
                    .stroke(Color(.separator).opacity(0.22), lineWidth: 0.5)
            }
    }
}
```

Use only semantic colors and SF Symbols. Do not add shadows or gradients.

- [ ] **Step 4: Implement the Widget root and current-card composition**

```swift
struct DailyKanjiWidgetHomeView: View {
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @State private var showsScope = false
    @State private var showsHistory = false

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DailyKanjiDesign.sectionSpacing) {
                scopeButton
                if let card = model.selectedCard {
                    DailyKanjiWidgetCardView(card: card, historyContext: model.selectedHistoryContext, audioPlayer: audioPlayer)
                } else {
                    emptyScope
                }
                recentSection
            }
            .padding(.horizontal, DailyKanjiDesign.pageInset)
            .padding(.bottom, 32)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Widget")
        .toolbar { settingsToolbar }
    }

    private var scopeButton: some View {
        Button { showsScope = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "rectangle.stack")
                VStack(alignment: .leading, spacing: 2) {
                    Text("Percorso widget").font(.headline)
                    Text(model.activeStudyScopeSummary).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }

    private var emptyScope: some View {
        ContentUnavailableView {
            Label("Nessuna scheda", systemImage: "rectangle.stack.badge.minus")
        } description: {
            Text("Scegli un altro percorso per continuare.")
        } actions: {
            Button("Cambia percorso") { showsScope = true }
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recenti").font(.title2.bold())
                Spacer()
                Button("Vedi tutti") { showsHistory = true }
            }
            ForEach(Array(model.recentHistory.prefix(3))) { item in
                Button {
                    model.selectHistoryItem(item)
                } label: {
                    DailyKanjiHistoryRow(item: item, card: model.card(for: item))
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ToolbarContentBuilder
    private var settingsToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            DailyKanjiSettingsToolbarButton(action: openSettings)
        }
    }
}
```

The card shows front, reading, meaning, audio, and the first JP/IT example. Put priority reason, SRS metrics, notes, source, and history context inside a `DisclosureGroup("Perché questa scheda")`.

- [ ] **Step 5: Implement scope and history sheets**

The scope sheet uses `Form`, a mode `Picker`, a conditional media `Picker`, count text, and toolbar actions. Dismiss after apply; reset the draft on cancel and interactive dismiss:

```swift
ToolbarItem(placement: .cancellationAction) {
    Button("Annulla") {
        model.resetStudyScopeDraft()
        dismiss()
    }
}
ToolbarItem(placement: .confirmationAction) {
    Button("Applica") {
        model.applyStudyScope()
        dismiss()
    }
    .disabled(!model.hasStudyScopeDraftChanges)
}
```

The main screen shows at most three recent rows; the full sheet uses all `model.recentHistory` entries and calls `model.selectHistoryItem` before dismissing.

- [ ] **Step 6: Verify Dynamic Type-safe layouts and run tests**

Use `ViewThatFits(in: .horizontal)` for reading/audio and avoid `lineLimit(1)` on the Japanese front. Run the Task 1 test command. Expected: PASS.

- [ ] **Step 7: Commit the Widget feature**

```bash
git add apps/daily-kanji-ios/App/DesignSystem apps/daily-kanji-ios/App/Features/Widget apps/daily-kanji-ios/App/ContentView.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "feat(ios): rebuild widget companion surface"
```

---

### Task 3: Ripasso feature

**Files:**
- Create: `apps/daily-kanji-ios/App/Features/Review/DailyKanjiReviewHomeView.swift`
- Create: `apps/daily-kanji-ios/App/Features/Review/DailyKanjiReviewCardView.swift`
- Modify: `apps/daily-kanji-ios/App/Presentation/DailyKanjiPresentations.swift`
- Modify: `apps/daily-kanji-ios/App/ContentView.swift`
- Test: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

**Interfaces:**
- Consumes: `DailyKanjiLiveReviewState`, `DailyKanjiLiveReviewCardPresentation`, `DailyKanjiAudioPlayer`.
- Produces: `DailyKanjiReviewHomeView(model:openSettings:)`.

- [ ] **Step 1: Add failing review-state copy tests**

```swift
func testUnconfiguredReviewUsesProductCopy() {
    let presentation = DailyKanjiLiveReviewStatusPresentation(state: .unavailable)
    XCTAssertEqual(presentation.title, "Ripasso non disponibile")
    XCTAssertEqual(presentation.emptyText, "Questa installazione non include il ripasso live.")
    XCTAssertFalse(presentation.subtitle.localizedCaseInsensitiveContains("server"))
}
```

- [ ] **Step 2: Run tests and confirm the old developer-facing copy fails**

Run the Task 1 test command. Expected: FAIL on the presentation strings.

- [ ] **Step 3: Build the Ripasso root state machine**

```swift
struct DailyKanjiReviewHomeView: View {
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @State private var answerRevealed = false

    var body: some View {
        Group {
            if let card = model.liveReviewState.session?.selectedCard {
                DailyKanjiReviewCardView(
                    model: model,
                    card: card,
                    answerRevealed: $answerRevealed,
                    audioPlayer: audioPlayer
                )
            } else {
                reviewEmptyState
            }
        }
        .navigationTitle("Ripasso")
        .toolbar { reviewToolbar }
    }

    private var reviewEmptyState: some View {
        let presentation = DailyKanjiLiveReviewStatusPresentation(state: model.liveReviewState)
        return ContentUnavailableView {
            Label(presentation.title, systemImage: presentation.systemImage)
        } description: {
            Text(presentation.emptyText)
        } actions: {
            if model.liveReviewState == .unavailable {
                Button("Apri Impostazioni", action: openSettings)
            } else if presentation.canRefresh {
                Button("Riprova") { model.refreshLiveReviewNow() }
            }
        }
    }

    @ToolbarContentBuilder
    private var reviewToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Aggiorna", systemImage: "arrow.clockwise") {
                model.refreshLiveReviewNow()
            }
            .labelStyle(.iconOnly)
            DailyKanjiSettingsToolbarButton(action: openSettings)
        }
    }
}
```

For `.unavailable`, the empty state includes `Apri Impostazioni`. For `.failed`, show `Riprova`; if a stale session exists, render it read-only and disable grading.

- [ ] **Step 4: Build reveal, answer, and grading layouts**

Keep the existing reveal/preload/grade behavior. Use a two-column rating grid at normal sizes and a single-column stack at accessibility sizes. The primary CTA is `Mostra risposta`; audio labels include the card reading. Preserve optimistic grading and response-time tracking by continuing to call `model.gradeLiveReview(_:)`.

- [ ] **Step 5: Run all iOS tests and commit the Ripasso feature**

Run the Task 1 test command. Expected: PASS.

```bash
git add apps/daily-kanji-ios/App/Features/Review apps/daily-kanji-ios/App/Presentation apps/daily-kanji-ios/App/ContentView.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "feat(ios): rebuild live review flow"
```

---

### Task 4: Cerca and glossary detail

**Files:**
- Create: `apps/daily-kanji-ios/App/Features/Search/DailyKanjiGlossaryHomeView.swift`
- Create: `apps/daily-kanji-ios/App/Features/Search/DailyKanjiGlossaryDetailView.swift`
- Modify: `apps/daily-kanji-ios/App/Presentation/DailyKanjiPresentations.swift`
- Modify: `apps/daily-kanji-ios/App/ContentView.swift`
- Test: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

**Interfaces:**
- Consumes: `DailyKanjiGlossarySearchModel`, `DailyKanjiGlossaryEntry`, `DailyKanjiAudioPlayer`.
- Produces: `DailyKanjiGlossaryHomeView(model:openSettings:)` and pushed `DailyKanjiGlossaryDetailView(entry:)`.

- [ ] **Step 1: Add failing glossary presentation tests**

```swift
func testGrammarEntriesUseItalianKindLabel() {
    XCTAssertEqual(DailyKanjiEntryKind.grammar.glossaryLabel, "Grammatica")
}

func testGlossaryRowSummaryDoesNotExposeLongNotes() {
    let entry = makeGlossaryEntry(notes: String(repeating: "nota ", count: 80))
    XCTAssertFalse(entry.rowSummary.contains("nota nota nota nota"))
}
```

- [ ] **Step 2: Run tests and confirm the Italian label/row projection fails**

Run the Task 1 test command. Expected: FAIL.

- [ ] **Step 3: Implement the searchable compact list**

```swift
struct DailyKanjiGlossaryHomeView: View {
    @ObservedObject var model: DailyKanjiAppModel
    let openSettings: () -> Void
    @StateObject private var search: DailyKanjiGlossarySearchModel

    init(model: DailyKanjiAppModel, openSettings: @escaping () -> Void) {
        self.model = model
        self.openSettings = openSettings
        _search = StateObject(
            wrappedValue: DailyKanjiGlossarySearchModel(entries: model.glossaryEntries)
        )
    }

    var body: some View {
        List(search.results) { entry in
            NavigationLink {
                DailyKanjiGlossaryDetailView(entry: entry)
            } label: {
                DailyKanjiGlossaryRow(entry: entry)
            }
        }
        .listStyle(.plain)
        .searchable(
            text: Binding(
                get: { search.query },
                set: { search.updateQuery($0) }
            ),
            prompt: "Termine, lettura o significato"
        )
        .navigationTitle("Cerca")
    }
}
```

Keep the audio button as a separate 44 pt target. Do not repeat long notes or full media names in rows. Update the search model when `model.glossaryEntries` changes.

- [ ] **Step 4: Implement the pushed detail with semantic sections**

Use `List` sections for `Significato`, `Pronuncia`, `Esempio e note`, and `Fonti`. Preserve bundled-audio lookup and pitch-accent rendering. The navigation title is the entry label and supports multiple lines in content.

- [ ] **Step 5: Run all iOS tests and commit the Cerca feature**

Run the Task 1 test command. Expected: PASS.

```bash
git add apps/daily-kanji-ios/App/Features/Search apps/daily-kanji-ios/App/Presentation apps/daily-kanji-ios/App/ContentView.swift apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "feat(ios): rebuild glossary search"
```

---

### Task 5: Centralized Settings and final app shell

**Files:**
- Create: `apps/daily-kanji-ios/App/Features/Settings/DailyKanjiSettingsView.swift`
- Replace: `apps/daily-kanji-ios/App/ContentView.swift`
- Modify: `apps/daily-kanji-ios/App/DesignSystem/DailyKanjiDesign.swift`
- Modify: `apps/daily-kanji-ios/App/DailyKanjiAppModel.swift`
- Test: `apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift`

**Interfaces:**
- Consumes: the four feature roots and `DailyKanjiAppModel.selectedTab`.
- Produces: final `ContentView(model:)` shell and `DailyKanjiSettingsView(model:)`.

- [ ] **Step 1: Add failing shell and settings source-contract tests**

```swift
func testAppShellUsesNativeTabViewWithoutSegmentedPicker() throws {
    let source = try Self.appSourceFileContents(relativePath: "ContentView.swift")
    XCTAssertTrue(source.contains("TabView"))
    XCTAssertTrue(source.contains("DailyKanjiWidgetHomeView"))
    XCTAssertTrue(source.contains("DailyKanjiReviewHomeView"))
    XCTAssertTrue(source.contains("DailyKanjiGlossaryHomeView"))
    XCTAssertFalse(source.contains("pickerStyle(.segmented)"))
}

func testSettingsCentralizesOperationalStatus() throws {
    let source = try Self.appSourceFileContents(
        relativePath: "Features/Settings/DailyKanjiSettingsView.swift"
    )
    XCTAssertTrue(source.contains("Dati"))
    XCTAssertTrue(source.contains("Ripasso"))
    XCTAssertTrue(source.contains("Widget"))
    XCTAssertFalse(source.contains("MOBILE_API_TOKEN"))
}
```

- [ ] **Step 2: Run tests and confirm the shell/settings tests fail**

Run the Task 1 test command. Expected: FAIL.

- [ ] **Step 3: Build Settings as one native Form**

```swift
struct DailyKanjiSettingsView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var showsScope = false

    var body: some View {
        NavigationStack {
            Form {
                dataSection
                reviewSection
                widgetSection
                aboutSection
            }
            .navigationTitle("Impostazioni")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine") { dismiss() }
                }
            }
        }
    }
}
```

Show source/status/counts and refresh actions, never endpoint/token values. Reuse `DailyKanjiWidgetScopeSheet` from the Widget feature.

- [ ] **Step 4: Replace ContentView with the final tab shell**

```swift
struct ContentView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @State private var showsSettings = false

    var body: some View {
        TabView(selection: tabBinding) {
            NavigationStack {
                DailyKanjiWidgetHomeView(model: model) { showsSettings = true }
            }
            .tabItem { Label(DailyKanjiAppTab.widget.label, systemImage: DailyKanjiAppTab.widget.systemImage) }
            .tag(DailyKanjiAppTab.widget)

            NavigationStack {
                DailyKanjiReviewHomeView(model: model) { showsSettings = true }
            }
            .tabItem { Label(DailyKanjiAppTab.review.label, systemImage: DailyKanjiAppTab.review.systemImage) }
            .tag(DailyKanjiAppTab.review)

            NavigationStack {
                DailyKanjiGlossaryHomeView(model: model) { showsSettings = true }
            }
            .tabItem { Label(DailyKanjiAppTab.search.label, systemImage: DailyKanjiAppTab.search.systemImage) }
            .tag(DailyKanjiAppTab.search)
        }
        .tint(.accentColor)
        .sheet(isPresented: $showsSettings) {
            DailyKanjiSettingsView(model: model)
        }
    }

    private var tabBinding: Binding<DailyKanjiAppTab> {
        Binding(
            get: { model.selectedTab },
            set: { model.selectTab($0) }
        )
    }
}
```

Each `tab` wraps its root in a separate `NavigationStack`. On selection call `model.selectTab`. Keep lifecycle activation/audio behavior inside the owning feature.

- [ ] **Step 5: Remove the old monolithic feature code**

Delete old daily/review/glossary/scope/history views and private presentation extensions from `ContentView.swift`. Target size is below 140 lines and it must contain no card, review, search, or settings rendering details.

- [ ] **Step 6: Run all iOS tests and commit the integrated shell**

Run the Task 1 test command. Expected: PASS.

```bash
git add apps/daily-kanji-ios/App apps/daily-kanji-ios/Tests/DailyKanjiCoreTests.swift
git commit -m "feat(ios): integrate redesigned app shell"
```

---

### Task 6: Documentation, build gates, and simulator visual QA

**Files:**
- Modify: `apps/daily-kanji-ios/README.md`
- Modify: `docs/qa-manual-checklist.md`
- Create: screenshot artifacts under the current Codex visualization directory (not committed)

**Interfaces:**
- Produces: verified app binary and visual evidence for reviewer.

- [ ] **Step 1: Update product and QA documentation**

Document `Widget · Ripasso · Cerca`, centralized Settings, the scope sheet, hourly widget cadence, review unavailable state, and the visual QA matrix. Remove obsolete statements that the main screen exposes inline selectors or status blocks.

- [ ] **Step 2: Run repository iOS gates**

```bash
./scripts/with-node.sh pnpm test:ios-ops
DAILY_KANJI_IOS_TEST_DESTINATION='platform=iOS Simulator,id=8D2F3E35-D0E3-4E7E-970E-9829A5A89FAC' \
  ./scripts/with-node.sh pnpm daily-kanji:test
```

Expected: both PASS.

- [ ] **Step 3: Build and install on the booted simulator**

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project apps/daily-kanji-ios/DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=8D2F3E35-D0E3-4E7E-970E-9829A5A89FAC' \
  -derivedDataPath apps/daily-kanji-ios/build/SimulatorDerivedData \
  build
```

Install the resulting `.app` with `xcrun simctl install`, launch `dev.local.daily-kanji`, and capture all states listed in the spec.

- [ ] **Step 4: Verify appearance and accessibility variants**

Capture standard Light, Dark, and Accessibility XXL for all three roots plus Settings; verify the scope sheet, glossary detail, deep link, and compact viewport. Fix clipping, contrast, layout priority, scroll reachability, or awkward empty states before continuing.

- [ ] **Step 5: Confirm the Widget target is untouched and commit docs/fixes**

```bash
git diff --exit-code -- apps/daily-kanji-ios/WidgetExtension/DailyKanjiWidget.swift
git diff --check
git add apps/daily-kanji-ios docs/qa-manual-checklist.md
git commit -m "docs(ios): document redesigned app flow"
```

---

### Task 7: Independent review loop and final delivery

**Files:**
- Modify: only files named by actionable reviewer findings.

**Interfaces:**
- Consumes: design spec, implementation plan, full git diff, simulator screenshots, and gate output.
- Produces: explicit independent `GREEN` verdict.

- [ ] **Step 1: Spawn a fresh independent reviewer after the app is complete**

Give the reviewer no implementation role. Ask it to inspect the whole iOS layout, architecture, copy, Dynamic Type, accessibility, native iOS conventions, protected widget contracts, tests, and screenshots. Require prioritized actionable findings or the exact verdict `GREEN`.

- [ ] **Step 2: Address every actionable finding**

For each finding, reproduce it from code or simulator evidence, add/adjust a regression test when practical, implement the smallest complete correction, and rerun the relevant test plus simulator state.

- [ ] **Step 3: Return the same implementation to independent review**

Send the reviewer the new commit/diff, updated screenshots, and verification output. Repeat Steps 2–3 until it returns `GREEN`; do not self-declare green.

- [ ] **Step 4: Run final gates from a clean index**

```bash
./scripts/with-node.sh pnpm test:ios-ops
DAILY_KANJI_IOS_TEST_DESTINATION='platform=iOS Simulator,id=8D2F3E35-D0E3-4E7E-970E-9829A5A89FAC' \
  ./scripts/with-node.sh pnpm daily-kanji:test
git diff --check
git status --short
```

- [ ] **Step 5: Commit reviewer fixes and push main**

Stage only redesign files and documentation, then:

```bash
git commit -m "fix(ios): address independent redesign review"
git push origin main
```

If there are no post-review changes to commit, push the already-green implementation commits directly.
