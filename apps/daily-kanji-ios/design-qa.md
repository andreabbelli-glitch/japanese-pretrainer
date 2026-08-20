# Daily Kanji iOS — design QA

## Visual target

- Source mock:
  `/Users/abelli/.codex/generated_images/01a01ae1-3067-7cf0-8d3d-7f7db94a1d7f/exec-ae463d7f-5832-4115-9cd6-ca28bd818a24.png`
  (853×1844).
- Final implementation:
  `/Users/abelli/.codex/visualizations/2026/08/19/01a01ae1-3067-7cf0-8d3d-7f7db94a1d7f/daily-kanji-ios-redesign/widget-light-large-restored-final.png`
  (1170×2532, iPhone 13, Light, Dynamic Type Large).
- Same-input comparison:
  `/Users/abelli/.codex/visualizations/2026/08/19/01a01ae1-3067-7cf0-8d3d-7f7db94a1d7f/daily-kanji-ios-redesign/mock-vs-widget-light-large-final-approved.png`
  (2340×2532). The mock was resized to the implementation viewport before
  comparison.

The implementation retains the selected mock's hierarchy and restrained
density: one clear title, one scope control, one primary study card and recent
items. `Widget` replaces the ambiguous `Oggi` label. Fake progress and favorite
state were not copied; real scope counts and real recent history are shown.
System font, semantic colors, SF Symbols, native navigation and the iOS 26 tab
bar remain authoritative. Study content is left aligned and its audio action is
separate so Dynamic Type and VoiceOver do not compete for the same width.

## Verified states

All iPhone 13 captures are 1170×2532. Compact captures use an iPhone SE (3rd
generation) simulator and are 750×1334.

| Surface or flow | State | Evidence |
| --- | --- | --- |
| Widget | Light, Large, approved deep-linked card | `widget-light-large-restored-final.png` |
| Widget | Dark, Large | `widget-dark-large-final-approved.png` |
| Widget | Light, Accessibility XXL | `widget-accessibility-xxl-final.png` |
| Widget | disclosure expanded, localized reviewer fix | `widget-disclosure-light-large-review-fixes.png` |
| Widget | history sheet, localized reviewer fix | `widget-history-light-large-review-fixes.png` |
| Widget | history sheet with real Widget-origin row | `widget-history-widget-source-light-large-final.png` |
| Widget | scope draft sheet | `widget-scope-sheet-light-large.png` |
| Ripasso | unavailable, Light/Dark/Accessibility XXL | `review-unavailable-light-large-final.png`, `review-unavailable-dark-large.png`, `review-unavailable-accessibility-xxl-final.png` |
| Ripasso | configured front, Light/Large | `review-configured-front-light-large-final.png` |
| Ripasso | configured answer, enabled audio and all ratings before details, Light/Large | `review-ratings-prioritized-rich-light-large.png` |
| Ripasso | exact `5枚以下なら` front, adaptive one-line type, Dark/Large | `review-front-word-safe-dark-large.png` |
| Ripasso | exact `5枚以下なら` front, word-safe fallback, Dark/Accessibility XXL | `review-front-word-safe-dark-accessibility-xxl.png` |
| Ripasso layout harness, 310 pt | exact `5枚以下なら`, full hosted render, Dark/Large and Accessibility XXL | `review-front-exact-full-dark-large.png`, `review-front-exact-full-dark-accessibility-xxl.png` |
| Ripasso layout harness, 310 pt | long real Vanguard front, full hosted render without ellipsis, Dark/Large and Accessibility XXL | `review-front-long-full-dark-large.png`, `review-front-long-full-dark-accessibility-xxl.png` |
| Ripasso | configured front, Light/Accessibility XXL | `review-configured-front-accessibility-xxl-final.png` |
| Ripasso | configured answer, enabled audio and vertical rating order, Light/Accessibility XXL | `review-ratings-prioritized-accessibility-xxl.png` plus semantic hierarchy verification |
| Cerca | results, Light/Dark | `search-root-light-large-final.png`, `search-root-dark-large.png` |
| Cerca | Accessibility XXL with inline search field | `search-root-accessibility-xxl-inline-final.png` |
| Cerca | pushed detail | `search-detail-light-large-final.png`, `search-detail-accessibility-xxl.png` |
| Cerca | localized alias taxonomy | `search-detail-alias-light-large-review-fixes.png` |
| Cerca | localized no-results state | `search-no-results-light-large-final.png`, `search-no-results-accessibility-xxl-final-passed.png` |
| Impostazioni | Light/Dark/Accessibility XXL | `settings-light-large-final.png`, `settings-dark-large.png`, `settings-accessibility-xxl-final.png` |
| Impostazioni | unconfigured notification state, no CTA | `settings-light-large-review-fixes.png` |
| Deep link | selected-card result after confirmation | `deep-link-card-widget-opened-final.png` |
| Compact viewport | Widget, Cerca, Ripasso and Impostazioni | `widget-compact-se-light-large-final-clean.png`, `search-compact-se-light-large-final.png`, `review-compact-se-light-large-final.png`, `settings-compact-se-light-large-final.png` |

Evidence directory:
`/Users/abelli/.codex/visualizations/2026/08/19/01a01ae1-3067-7cf0-8d3d-7f7db94a1d7f/daily-kanji-ios-redesign/`.

Change-specific Ripasso evidence directory:
`/Users/abelli/.codex/visualizations/2026/08/20/daily-kanji-review-priority/`.

Word-safe front evidence directory:
`/Users/abelli/.codex/visualizations/2026/08/20/daily-kanji-review-word-safe/`.
The same-input before/after comparison is
`reference-vs-word-safe-dark-large-final.png`.

## Iterations and findings

| Iteration | Finding | Resolution | Result |
| --- | --- | --- | --- |
| 1 | P1: the Widget scope summary collapsed into a narrow column at Accessibility XXL. | Switch the scope row from compact to stacked at accessibility sizes, preserving its 44-point target and VoiceOver label. | passed |
| 2 | P1: glossary summaries and their audio action competed for width at Accessibility XXL. | Stack the row, keep the summary full width, and place the separate 44-point audio action on its own trailing row. | passed |
| 3 | P2: the system no-results copy appeared in English. | Provide product-owned Italian title and description while retaining native `ContentUnavailableView`. | passed |
| 4 | P1: `追いつく` wrapped at Dynamic Type Large despite available card width. | Expand the vertical study group to the card width and reduce its scaled base front size from 92 to 64 points. | passed |
| 5 | P1: the system `.searchable` field hid its icon and prompt at Accessibility XXL. | Keep `.searchable` at standard sizes and use a bound, full-width native inline field at accessibility sizes. | passed |
| 6 | P1: the first localized no-results attempt overlapped at Accessibility XXL; after shortening it, the native title still rendered as `Nessun risul…`. | Keep native `ContentUnavailableView` and a bounded query at standard sizes, but use a dedicated multiline empty-results layout at accessibility sizes. The decorative icon is hidden from VoiceOver and the combined title/description ends above the tab bar. | passed |
| 7 | P2: the initial evidence covered only the unavailable Ripasso state. | Install a temporary build configured against the isolated local E2E API, then verify front, reveal, enabled remote audio, scroll and all four rating controls at Large and Accessibility XXL. Submitting `Facile` advanced the selected card and reduced the queue from 20 to 19. | passed |
| 8 | P2: the live queue subtitle mixed Italian with English `due` and could expose a raw ISO timestamp. | Add Italian singular/plural copy, ISO-8601 parsing with and without fractional seconds, locale-aware date/time formatting and a non-raw fallback. | passed |
| 9 | P2: the `Facile` preview exposed `Il 2026-08-28`, while long intervals truncated at accessibility sizes. | Localize absolute preview dates and allow interval labels two lines with vertical expansion only at accessibility sizes. | passed |
| 10 | P1: the compact review header and one-line media title truncated `Duel Masters` at Accessibility XXL. | Add a tested compact/stacked header policy; at accessibility sizes, give the multiline media title and readable queue separate full-width rows with vertical expansion. The refreshed unscrolled front shows both `Duel Masters` and `17 in coda` in full; the separate answer capture is intentionally scrolled to document revealed content and enabled audio. | passed |
| 11 | P1: `Aggiorna ripasso` in Settings was a no-op when the sheet originated from Widget or Cerca because live fetching was tab-scoped. | Give the manual action an explicit model contract that selects Ripasso and forces a fetch from either origin; retain tab-scoped automatic foreground refresh. Two cross-tab model tests cover the real starts. | passed |
| 12 | P2: residual English copy and raw taxonomy remained in history, rationale metrics, unavailable study fields and glossary aliases; sync failures could also expose arbitrary technical text. | Localize relative-time thresholds and singular/plural forms, offline fallbacks, `Difficile / Di nuovo`, and all current alias types; map unknown aliases to `altra forma` and render only stable Italian sync-failure copy. Refreshed disclosure, history and alias-detail captures were visually checked at Light/Large. | passed |
| 13 | P1: notification permission was requested during bootstrap, before a user decision, and Settings inferred only build capability instead of the real authorization state. | Query authorization read-only on activation, prompt only after explicit `Attiva notifiche`, route denied/authorized states to system settings, re-register already-authorized installs with APNs without prompting, and leave unconfigured builds actionless. The refreshed Settings capture confirms the unconfigured state has no CTA; lifecycle and status matrices are unit-tested. | passed |
| 14 | P2: the Widget history source still rendered the English product copy `Widget slot`; the prior history capture contained only App-origin rows and could not expose it. | Localize the shared source label to `Widget`, cover the real metadata presentation with a regression test, and recapture a clean Light/Large history containing both an App row and a real Widget-origin row. | passed |
| 15 | P1: examples, translation and notes appeared before the FSRS controls, forcing a scroll before every rating. | Make revealed-answer order an explicit tested presentation contract: reading/meaning, pitch and audio, all four ratings, then supplemental details. The rich `山札` Light/Large capture shows every rating fully visible above the first example. At Accessibility XXL the controls remain vertical; the semantic hierarchy places ratings before every detail node and the enclosing review surface remains scrollable. | independent review passed |
| 16 | P1: the review front could wrap CJK at an arbitrary character boundary, rendering `5枚以下なら` as `5枚以` / `下なら`. | Protect Natural Language word tokens from internal line breaks and choose the largest fitting single-line font tier before a multiline fallback. The exact card stays on one line at Large; at Accessibility XXL it wraps only between `以下` and `なら`, leaving `以下` intact. | independent review passed |
| 17 | P2: the first fallback capped real long fronts at two or three lines, while its tokenizer-only regression did not exercise the live SwiftUI layout. | Remove the fallback line cap and render the exact plus a long real front through the production component at 310 pt in XCTest for Large and Accessibility XXL. Keep the four full render attachments, assert vertical expansion, and render the complete card so reverting the production wiring makes the test fail. | independent review passed |

No P0, P1, P2 or P3 findings remain after the independent review, configured
review session, notification lifecycle matrix and refreshed Light/Large
comparison. The temporary QA API used only the disposable
E2E database; its selected `山札` card exposed one real `audio/mpeg` resource,
the app audio control was enabled and the simulator event log recorded the tap.
The WidgetKit extension was not changed by the redesign.

final result: passed
