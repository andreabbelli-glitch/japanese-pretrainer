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
| Widget | disclosure expanded | `widget-disclosure-light-large.png` |
| Widget | history sheet | `widget-history-light-large.png` |
| Widget | scope draft sheet | `widget-scope-sheet-light-large.png` |
| Ripasso | unavailable, Light/Dark/Accessibility XXL | `review-unavailable-light-large-final.png`, `review-unavailable-dark-large.png`, `review-unavailable-accessibility-xxl-final.png` |
| Ripasso | configured front, Light/Large | `review-configured-front-light-large-final.png` |
| Ripasso | configured answer and enabled audio, Light/Large | `review-configured-answer-audio-light-large-final.png` |
| Ripasso | configured ratings after scroll, Light/Large | `review-configured-ratings-light-large-final.png` |
| Ripasso | configured front, Light/Accessibility XXL | `review-configured-front-accessibility-xxl-final.png` |
| Ripasso | configured answer and enabled audio, Light/Accessibility XXL | `review-configured-answer-accessibility-xxl-final.png` |
| Ripasso | configured ratings after scroll, Light/Accessibility XXL | `review-configured-ratings-accessibility-xxl-final.png` |
| Cerca | results, Light/Dark | `search-root-light-large-final.png`, `search-root-dark-large.png` |
| Cerca | Accessibility XXL with inline search field | `search-root-accessibility-xxl-inline-final.png` |
| Cerca | pushed detail | `search-detail-light-large-final.png`, `search-detail-accessibility-xxl.png` |
| Cerca | localized no-results state | `search-no-results-light-large-final.png`, `search-no-results-accessibility-xxl-final-passed.png` |
| Impostazioni | Light/Dark/Accessibility XXL | `settings-light-large-final.png`, `settings-dark-large.png`, `settings-accessibility-xxl-final.png` |
| Deep link | selected-card result after confirmation | `deep-link-card-widget-opened-final.png` |
| Compact viewport | Widget, Cerca, Ripasso and Impostazioni | `widget-compact-se-light-large-final-clean.png`, `search-compact-se-light-large-final.png`, `review-compact-se-light-large-final.png`, `settings-compact-se-light-large-final.png` |

Evidence directory:
`/Users/abelli/.codex/visualizations/2026/08/19/01a01ae1-3067-7cf0-8d3d-7f7db94a1d7f/daily-kanji-ios-redesign/`.

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

No P0, P1, P2 or P3 findings remain after the final comparison, configured
review session and state matrix. The temporary QA API used only the disposable
E2E database; its selected `山札` card exposed one real `audio/mpeg` resource,
the app audio control was enabled and the simulator event log recorded the tap.
The WidgetKit extension was not changed by the redesign.

final result: passed
