# Fix: entry metadata eccessivi — query summary troppo pesanti per la review

## Problema

`listTermEntrySummaries` e `listGrammarEntrySummaries` in `src/db/queries/glossary.ts`
caricano **28+ campi** per entry (audio, pitch accent, search normalization, etc.),
ma i consumer li usano in modo molto diverso:

| Consumer | File | Campi usati (term) |
|---|---|---|
| `buildEntryLookup` (review) | `src/lib/review.ts` | `id`, `sourceId`, `lemma`, `reading`, `romaji`, `meaningIt`, `mediaSlug`, audio*, pitch*, `entryStatus` |
| `buildReviewSubjectEntryLookup` | `src/lib/review-subject.ts` | `id`, `crossMediaGroupId` |
| `buildReviewEntryStatusLookup` | `src/lib/review.ts` | `id`, `entryStatus` |
| `mapTermSummaryToBaseModel` (glossary) | `src/lib/glossary.ts` | **TUTTI** i 28 campi (compresi searchNorms) |
| `loadGlossaryProgressSnapshots` | `src/lib/study-metrics.ts` | `id`, `sourceId`, `mediaId`, `lemma`, `meaningIt`, `reading`, `segmentTitle`, `entryStatus` |

Il **glossary** è l'unico consumer che ha bisogno di tutti i campi. La **review** e
le **study-metrics** ne usano una frazione ma pagano il costo di caricare tutto.

### Impatto

Con 1000+ entry per media, per ogni caricamento della review page:
- ~6 colonne audio (audioSrc, audioSource, audioSpeaker, audioLicense, audioAttribution, audioPageUrl)
- ~3 colonne pitch accent (pitchAccent, pitchAccentSource, pitchAccentPageUrl)
- ~3 colonne search normalization (searchLemmaNorm, searchReadingNorm, searchRomajiNorm)
- = **~12 colonne inutili** × 1000+ righe × 2 tabelle (terms + grammar)

## File coinvolti

| File | Cosa fare |
|---|---|
| `src/db/queries/glossary.ts` | Creare query leggere per review e study-metrics |
| `src/lib/review.ts` | Usare le nuove query leggere al posto delle summary |
| `src/lib/study-metrics.ts` | Usare le nuove query leggere al posto delle summary |
| `src/lib/glossary.ts` | Nessuna modifica — continua a usare le summary complete |

## Cosa fare

### 1. Creare query "review-weight" per terms e grammar

In `src/db/queries/glossary.ts`, crea due nuove funzioni che selezionano **solo** i
campi necessari alla review. Queste query devono avere gli stessi JOIN e WHERE
delle summary attuali ma con un `select` ridotto.

#### Campi necessari per la review (union di tutti i consumer review)

**Term review entry:**
```
id, sourceId, crossMediaGroupId, mediaId, segmentId,
lemma, reading, romaji, meaningIt,
audioSrc, audioSource, audioSpeaker, audioLicense, audioAttribution, audioPageUrl,
pitchAccent, pitchAccentSource, pitchAccentPageUrl,
mediaSlug, mediaTitle, segmentTitle, crossMediaGroupKey, entryStatus
```

**Nota critica:** `buildEntryLookup` in review.ts chiama `buildPronunciationData`
che usa i campi audio + pitch. Questi campi servono per mostrare la pronuncia sulla
card di review. Quindi audio/pitch **devono** restare nella review query.

I campi da **eliminare** dalla review query sono:
- `levelHint` — non usato nella review
- `searchLemmaNorm` — solo per search nel glossary
- `searchReadingNorm` — solo per search nel glossary
- `searchRomajiNorm` — solo per search nel glossary

Per grammar, elimina anche:
- `searchPatternNorm` — solo per search nel glossary

**Grammar review entry:**
```
id, sourceId, crossMediaGroupId, mediaId, segmentId,
pattern, title, reading, meaningIt,
audioSrc, audioSource, audioSpeaker, audioLicense, audioAttribution, audioPageUrl,
pitchAccent, pitchAccentSource, pitchAccentPageUrl,
mediaSlug, mediaTitle, segmentTitle, crossMediaGroupKey, entryStatus
```

**ATTENZIONE:** Ricalcola il risparmio effettivo: con solo 4 campi eliminati
(searchNorms + levelHint), il guadagno potrebbe sembrare modesto. Ma i campi
search norm sono stringhe duplicate della label normalizzata — in SQLite non c'è
true column pruning sullo storage, ma il risparmio è reale sul transfer e parsing
del result set in JS (meno proprietà da deserializzare per 1000+ righe).

Se il risparmio di soli 4 campi sembra troppo poco, considera un'alternativa più
aggressiva per `buildReviewSubjectEntryLookup` e `buildReviewEntryStatusLookup`:
queste due funzioni usano solo `id` + `crossMediaGroupId` + `entryStatus`. Si
potrebbe creare una terza query ultra-leggera per questi, ma questo aggiunge
complessità — valuta se ne vale la pena.

### 2. Aggiungere nuove funzioni query

```ts
// In src/db/queries/glossary.ts

export async function listTermEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select({
      id: term.id,
      sourceId: term.sourceId,
      crossMediaGroupId: term.crossMediaGroupId,
      mediaId: term.mediaId,
      segmentId: term.segmentId,
      lemma: term.lemma,
      reading: term.reading,
      romaji: term.romaji,
      meaningIt: term.meaningIt,
      audioSrc: term.audioSrc,
      audioSource: term.audioSource,
      audioSpeaker: term.audioSpeaker,
      audioLicense: term.audioLicense,
      audioAttribution: term.audioAttribution,
      audioPageUrl: term.audioPageUrl,
      pitchAccent: term.pitchAccent,
      pitchAccentSource: term.pitchAccentSource,
      pitchAccentPageUrl: term.pitchAccentPageUrl,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey,
      entryStatus: entryStatus.status
    })
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .leftJoin(
      entryStatus,
      and(eq(entryStatus.entryId, term.id), eq(entryStatus.entryType, "term"))
    )
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

// Analogo per grammar — ometti searchPatternNorm e levelHint
export async function listGrammarEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  // Stessa struttura, ma senza searchPatternNorm e levelHint
  // ...
}
```

### 3. Creare il type corrispondente

Il tipo di ritorno sarà inferito automaticamente dal select di Drizzle. Ma per
chiarezza, esportalo:

```ts
export type TermEntryReviewSummary = Awaited<
  ReturnType<typeof listTermEntryReviewSummaries>
>[number];

export type GrammarEntryReviewSummary = Awaited<
  ReturnType<typeof listGrammarEntryReviewSummaries>
>[number];
```

### 4. Aggiornare `src/db/index.ts`

Esporta le nuove funzioni e i nuovi tipi dal barrel file:

```ts
export {
  listTermEntryReviewSummaries,
  listGrammarEntryReviewSummaries,
  type TermEntryReviewSummary,
  type GrammarEntryReviewSummary
} from "./queries/glossary";
```

### 5. Aggiornare `src/lib/review.ts`

Sostituisci le chiamate a `listTermEntrySummaries` / `listGrammarEntrySummaries`
con le nuove `listTermEntryReviewSummaries` / `listGrammarEntryReviewSummaries`.

Il tipo `ReviewTermLookupEntry` (riga 113) va aggiornato per accettare anche il
nuovo tipo leggero:

```ts
type ReviewTermLookupEntry = TermGlossaryEntry | TermGlossaryEntrySummary | TermEntryReviewSummary;
type ReviewGrammarLookupEntry = GrammarGlossaryEntry | GrammarGlossaryEntrySummary | GrammarEntryReviewSummary;
```

**Verifica che tutti gli accessi ai campi delle entry in review.ts siano compatibili
con il tipo ridotto.** I campi rimossi (`levelHint`, `searchLemmaNorm`, etc.) non
devono essere acceduti da nessuna parte in review.ts — se il type-check passa, sei
a posto.

### 6. Aggiornare `src/lib/study-metrics.ts`

Anche study-metrics usa solo una frazione dei campi. Il tipo `TermGlossaryProgressEntry`
(riga 66) è già un `Pick<>` che richiede solo:
`id`, `sourceId`, `mediaId`, `lemma`, `meaningIt`, `reading`, `segmentTitle`, `entryStatus`

La nuova `TermEntryReviewSummary` include tutti questi campi, quindi study-metrics
può usare le review summaries senza problemi. Sostituisci gli import.

### 7. NON toccare `src/lib/glossary.ts`

Il glossary continua a usare `listTermEntrySummaries` / `listGrammarEntrySummaries`
con tutti i campi — inclusi search norms per il search client-side. Non modificarlo.

## Vincoli

- **NON** rimuovere le funzioni `listTermEntrySummaries` / `listGrammarEntrySummaries`
  esistenti — il glossary le usa ancora
- **NON** modificare `src/lib/glossary.ts`
- **NON** cambiare la struttura dei JOIN — le nuove query devono avere gli stessi
  JOIN delle summary attuali, solo con un select ridotto
- **NON** cambiare il tipo `ReviewPageData` — i client lo consumano invariato
- Assicurati che le nuove funzioni usino lo stesso `buildMediaScopeFilter` e
  `orderBy` delle query esistenti

## Verifica

```bash
npx tsc --noEmit          # type-check — verifica che i tipi ridotti siano compatibili
npm run build             # build completo
```

### Test manuale

1. Apri una review (media-scoped e global) → le card devono mostrare correttamente:
   - Front/back label e meaning
   - Pronuncia (audio player + pitch accent)
   - Stato entry (known/learning/new)
   - Cross-media grouping
2. Apri il glossary → deve funzionare identico (usa ancora le query piene)
3. Apri la progress page → i conteggi devono essere corretti (study-metrics)

## Note sul risparmio reale

Il risparmio principale di questo fix è modesto in termini di colonne (~4 per tabella).
Il beneficio reale è:
1. **Meno dati in transito** JS ← SQLite per 1000+ righe
2. **Meno proprietà da allocare** nel V8 heap per ogni oggetto entry
3. **Principio di separazione**: le query review e glossary non sono più accoppiate —
   evoluzioni future (es. aggiungere campi al glossary) non rallentano la review

Se il beneficio sembra insufficiente, l'alternativa più impattante è creare una
query ultra-leggera per `buildReviewSubjectEntryLookup` (solo `id` + `crossMediaGroupId`)
e `buildReviewEntryStatusLookup` (solo `id` + `entryStatus`) — queste sono le
funzioni chiamate per ogni caricamento e non hanno bisogno di audio/pitch.
