# Fase 2: Queue-as-Session — il client gestisce l'ordine, il server hydra una card alla volta

## Contesto

Nella Fase 1 è stata creata `hydrateReviewCard(cardId)` in `src/lib/review.ts`
(riga ~1321) che carica una singola card con 3-4 query per ID in O(1).

Oggi però le session actions (`gradeReviewCardSessionAction`, etc.) ignorano
completamente `hydrateReviewCard` e continuano a ricostruire l'intera
`ReviewPageData` da zero ad ogni azione, tramite `requireReviewPageDataForScope`
→ `getGlobalReviewPageData` / `getReviewPageData` → 8+ query full-table +
queue building completo.

## Obiettivo

Refactorare il flusso review perché:

1. **Initial page load:** calcola la queue completa come oggi, ma **invia al client
   anche la lista ordinata di cardId** (il "piano di sessione")
2. **Session actions (grade, markKnown, etc.):** il client manda il `nextCardId`
   (preso dal piano), il server scrive la mutazione + chiama `hydrateReviewCard`
   sulla prossima card + aggiorna i conteggi incrementalmente. **Zero full rebuild.**
3. **Queue-altering actions (suspend, markKnown, reset, extraNew):** causano un
   refresh del piano di sessione perché cambiano la composizione della queue

## Architettura del flusso

### Prima (oggi)

```
[Page load]  → full rebuild → ReviewPageData (card + conteggi + queue)
[Grade]      → full rebuild → ReviewPageData (card + conteggi + queue)  ← LENTO
[MarkKnown]  → full rebuild → ReviewPageData (card + conteggi + queue)  ← LENTO
[Suspend]    → full rebuild → ReviewPageData (card + conteggi + queue)  ← LENTO
```

### Dopo (obiettivo)

```
[Page load]  → full rebuild → ReviewPageData + cardIds[]   ← una volta sola
[Grade]      → write + hydrateReviewCard(nextId) → card + delta conteggi  ← VELOCE
[MarkKnown]  → write + full rebuild → ReviewPageData + cardIds[]  ← come page load
[Suspend]    → write + full rebuild → ReviewPageData + cardIds[]  ← come page load
[Reset]      → write + full rebuild → ReviewPageData + cardIds[]  ← come page load
```

La distinzione è: **il grade è il 90%+ delle azioni** e deve essere istantaneo.
Le altre azioni (markKnown, suspend, reset, setLearning) cambiano la composizione
della queue e possono continuare a fare full rebuild — sono rare.

## File da modificare

| File | Cosa fare |
|---|---|
| `src/lib/review.ts` | Aggiungere `queueCardIds: string[]` a `ReviewPageData` |
| `src/actions/review.ts` | Refactorare `gradeReviewCardSessionAction` |
| `src/components/review/review-page-client.tsx` | Gestire il piano di sessione lato client |

## Step implementativi

### Step 1: Aggiungere `queueCardIds` a `ReviewPageData`

In `src/lib/review.ts`, modifica il tipo `ReviewPageData` (riga ~759):

```ts
export type ReviewPageData = {
  // ... campi esistenti invariati ...
  queueCardIds: string[];  // ← NUOVO: lista ordinata dei cardId nella queue
};
```

In `buildReviewPageDataFromWorkspace` (riga ~904), dopo aver calcolato
`queueSnapshot`, estrai la lista di cardId in ordine dalla queue:

```ts
const queueCardIds = queueSnapshot.queueModels.map(
  (model) => model.globalCard.id
);
```

E aggiungilo al return:

```ts
return {
  // ... campi esistenti ...
  queueCardIds  // ← NUOVO
} satisfies ReviewPageData;
```

**ATTENZIONE:** `queueSnapshot.queueModels` contiene sia le due cards che le new
cards in ordine (è `[...dueCards, ...queuedNewCards]` — vedi
`buildReviewQueueSubjectSnapshot` riga ~2410). Questo è esattamente l'ordine in
cui il client deve processare le card.

### Step 2: Creare il nuovo return type per le azioni veloci

In `src/actions/review.ts`, crea un nuovo tipo per il risultato del grade veloce:

```ts
export type ReviewSessionGradeResult = {
  kind: "hydrated";
  card: ReviewQueueCard | null;
  queueCardIds: string[];  // la lista aggiornata (la card gradata è stata rimossa)
  session: ReviewPageData["session"];
  queue: ReviewPageData["queue"];
  selectedCardContext: ReviewPageData["selectedCardContext"];
};
```

**ATTENZIONE CRITICA:** Il tipo di ritorno DEVE essere compatibile con il client.
Il client oggi fa `setViewData(nextData)` dove `nextData` è `ReviewPageData`.
Ci sono due strategie:

**Strategia A (consigliata — minimo cambiamento client):** La session action
restituisce ancora `ReviewPageData`, ma lo costruisce in modo leggero:

```ts
// Il server restituisce un ReviewPageData "leggero"
return {
  scope: input.scope ?? "global",
  media: previousMedia,      // invariato dalla sessione
  settings: previousSettings, // invariato dalla sessione
  queue: updatedQueue,        // conteggi aggiornati incrementalmente
  queueCardIds: updatedIds,   // lista senza la card gradata
  selectedCard: hydratedCard, // la prossima card, hydrata
  selectedCardContext: { ... },
  session: { ... }
} satisfies ReviewPageData;
```

Il problema: `media` e `settings` non sono disponibili nel server senza una query.
Soluzione: **il client li manda come input alla session action**.

**Strategia B (più pulita, più lavoro client):** La session action restituisce un
tipo diverso (`ReviewSessionGradeResult`), e il client fa merge manualmente.

**Scegli Strategia A** — il client manda `media` e `settings` come parte dell'input
(sono dati che il client già possiede e che non cambiano durante la sessione).

### Step 3: Modificare `ReviewSessionInput`

In `src/actions/review.ts`, estendi `ReviewSessionInput`:

```ts
type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  cardMediaSlug?: string;
  extraNewCount: number;
  mediaSlug?: string;
  scope?: "global" | "media";
  // NUOVI campi per il fast path:
  nextCardId?: string;          // ID della prossima card (dal piano)
  sessionMedia?: ReviewPageData["media"];     // media context (invariato)
  sessionSettings?: ReviewPageData["settings"]; // settings (invariato)
  sessionQueue?: ReviewPageData["queue"];       // conteggi attuali per delta
};
```

I nuovi campi sono **opzionali** — se non presenti, l'azione cade nel fallback
(full rebuild). Questo garantisce backward compatibility con le form actions
redirect-based che non usano il fast path.

### Step 4: Refactorare `gradeReviewCardSessionAction`

```ts
export async function gradeReviewCardSessionAction(
  input: ReviewSessionInput & {
    rating: "again" | "hard" | "good" | "easy";
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  // 1. Scrivi il grade (come oggi)
  await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    rating: input.rating
  });

  revalidateActiveReviewPaths(input.mediaSlug ?? input.cardMediaSlug);

  // 2. FAST PATH: se il client ha mandato i dati di sessione, usa hydrateReviewCard
  if (input.nextCardId && input.sessionMedia && input.sessionSettings && input.sessionQueue) {
    const now = new Date();
    const hydratedCard = await hydrateReviewCard({
      cardId: input.nextCardId,
      now
    });

    // Aggiorna i conteggi incrementalmente
    const updatedQueue = buildIncrementalQueueUpdate(
      input.sessionQueue,
      "grade"
    );

    // Rimuovi la card gradata dalla lista di ID
    const updatedCardIds = (input.sessionQueue as any).queueCardIds
      // Non disponibile qui — vedi nota sotto

    return {
      scope: input.scope ?? "global",
      media: input.sessionMedia,
      settings: input.sessionSettings,
      queue: updatedQueue,
      queueCardIds: [], // Vedi nota sotto su come gestire
      selectedCard: hydratedCard,
      selectedCardContext: {
        bucket: hydratedCard?.bucket ?? null,
        gradePreviews: hydratedCard
          ? buildReviewGradePreviews(hydratedCard.reviewSeedState, now)
          : [],
        isQueueCard: true,
        position: null,   // Il client calcolerà dalla lista
        remainingCount: 0, // Il client calcolerà dalla lista
        showAnswer: false
      },
      session: {
        answeredCount: input.answeredCount + 1,
        extraNewCount: input.extraNewCount
      }
    } satisfies ReviewPageData;
  }

  // 3. FALLBACK: full rebuild (per form actions o client legacy)
  return requireReviewPageDataForScope(
    input,
    buildReviewSearchParams({
      answeredCount: input.answeredCount + 1,
      extraNewCount: input.extraNewCount
    })
  );
}
```

**NOTA IMPORTANTE sui `queueCardIds`:** Il client gestisce la lista localmente.
Il server non ha bisogno di restituirla aggiornata nel fast path — il client sa
quale card ha appena gradato e la rimuove dalla sua copia locale. Il server
restituisce `queueCardIds: []` o la stessa lista che aveva il client (il client
la ignora nel fast path perché usa la sua copia locale).

**Approccio consigliato:** nel fast path, il server manda `queueCardIds: []` e il
client usa la sua lista locale. La lista viene ri-sincronizzata solo al prossimo
full rebuild (extraNew, markKnown, suspend, etc.).

### Step 5: Helper per aggiornamento incrementale dei conteggi

In `src/actions/review.ts`, crea:

```ts
function buildIncrementalQueueUpdate(
  currentQueue: ReviewPageData["queue"],
  action: "grade" | "suspend" | "markKnown"
): ReviewPageData["queue"] {
  // Per il grade: la card esce dalla queue (due→upcoming, o new→learning)
  // I conteggi esatti dipendono dal bucket della card gradata.
  // Approccio semplice: decrementa queueCount di 1.
  return {
    ...currentQueue,
    queueCount: Math.max(0, currentQueue.queueCount - 1),
    dueCount: Math.max(0, currentQueue.dueCount - 1),
    // newQueuedCount resta invariato se la card era due,
    // oppure decrementa se era new — ma non sappiamo quale.
    // Soluzione: il client manda anche il bucket della card gradata.
  };
}
```

**Problema con i conteggi esatti:** Il server non sa se la card gradata era "due"
o "new" senza ricalcolare. Il client invece lo sa (`selectedCard.bucket`).

**Soluzione:** Aggiungi `gradedCardBucket` all'input:

```ts
type ReviewSessionInput = {
  // ... campi esistenti ...
  gradedCardBucket?: ReviewQueueCard["bucket"]; // il bucket della card appena gradata
};
```

Il client lo manda (è `viewData.selectedCard.bucket`). Il server lo usa per
aggiornare i conteggi correttamente:

```ts
function buildIncrementalQueueUpdate(
  currentQueue: ReviewPageData["queue"],
  gradedBucket: ReviewQueueCard["bucket"]
): ReviewPageData["queue"] {
  return {
    ...currentQueue,
    queueCount: Math.max(0, currentQueue.queueCount - 1),
    dueCount: gradedBucket === "due"
      ? Math.max(0, currentQueue.dueCount - 1)
      : currentQueue.dueCount,
    newQueuedCount: gradedBucket === "new"
      ? Math.max(0, currentQueue.newQueuedCount - 1)
      : currentQueue.newQueuedCount
  };
}
```

### Step 6: Modificare il client

In `src/components/review/review-page-client.tsx`:

#### 6a. Mantenere lo stato locale della queue di cardId

```ts
export function ReviewPageClient({ data }: { data: ReviewPageData }) {
  const [viewData, setViewData] = useState(data);
  const [queueCardIds, setQueueCardIds] = useState(data.queueCardIds);
  // ... resto invariato
```

#### 6b. Calcolare `position` e `remainingCount` dalla lista locale

```ts
const queueIndex = selectedCard
  ? queueCardIds.indexOf(selectedCard.id)
  : -1;
const position = queueIndex >= 0 ? queueIndex + 1 : null;
const remainingCount = queueIndex >= 0
  ? queueCardIds.length - queueIndex - 1
  : 0;
```

Usa questi valori calcolati localmente al posto di
`viewData.selectedCardContext.position` e
`viewData.selectedCardContext.remainingCount`. Questo è necessario perché nel
fast path il server non conosce la posizione (non ha la queue).

#### 6c. Modificare `handleGradeCard` per mandare i dati di sessione

```ts
function handleGradeCard(rating: (typeof ratingCopy)[number]["value"]) {
  if (!selectedCard) return;

  // Determina la prossima card dalla lista locale
  const currentIndex = queueCardIds.indexOf(selectedCard.id);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nextCardId = queueCardIds[nextIndex]; // può essere undefined se la queue è finita

  runSessionUpdate(async () => {
    const result = await gradeReviewCardSessionAction({
      answeredCount: viewData.session.answeredCount,
      cardId: selectedCard.id,
      cardMediaSlug: selectedCard.mediaSlug,
      extraNewCount: viewData.session.extraNewCount,
      gradedCardBucket: selectedCard.bucket,
      mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
      nextCardId,
      rating,
      scope: viewData.scope,
      sessionMedia: viewData.media,
      sessionQueue: viewData.queue,
      sessionSettings: viewData.settings
    });

    // Aggiorna la lista locale: rimuovi la card gradata
    setQueueCardIds((prev) => prev.filter((id) => id !== selectedCard.id));

    return result;
  });
}
```

**ATTENZIONE:** `runSessionUpdate` oggi fa `setViewData(nextData)` dentro `.then()`.
Il `setQueueCardIds` deve avvenire **nella stessa batch** di rendering. Verifica
che il pattern attuale lo permetta. Se `runSessionUpdate` usa `startTransition`,
entrambi i `setState` verranno batchati automaticamente da React 18+.

Refactora `runSessionUpdate` per supportare un callback post-update opzionale:

```ts
function runSessionUpdate(
  loadNextData: () => Promise<ReviewPageData>,
  onSuccess?: () => void
) {
  setClientError(null);
  startTransition(() => {
    void loadNextData()
      .then((nextData) => {
        setViewData(nextData);
        onSuccess?.();
      })
      .catch((error) => {
        console.error(error);
        setClientError(
          "Non sono riuscito ad aggiornare la review. Riprova un attimo."
        );
      });
  });
}
```

Oppure, più pulito: il `setQueueCardIds` viene fatto **prima** della call al server
(optimistic update), non dopo:

```ts
function handleGradeCard(rating: (typeof ratingCopy)[number]["value"]) {
  if (!selectedCard) return;

  const currentIndex = queueCardIds.indexOf(selectedCard.id);
  const nextCardId = queueCardIds[currentIndex + 1];

  // Optimistic: rimuovi la card dalla lista locale subito
  setQueueCardIds((prev) => prev.filter((id) => id !== selectedCard.id));

  runSessionUpdate(() =>
    gradeReviewCardSessionAction({
      answeredCount: viewData.session.answeredCount,
      cardId: selectedCard.id,
      cardMediaSlug: selectedCard.mediaSlug,
      extraNewCount: viewData.session.extraNewCount,
      gradedCardBucket: selectedCard.bucket,
      mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
      nextCardId,
      rating,
      scope: viewData.scope,
      sessionMedia: viewData.media,
      sessionQueue: viewData.queue,
      sessionSettings: viewData.settings
    })
  );
}
```

#### 6d. Sincronizzare `queueCardIds` quando arriva un full rebuild

Quando le azioni non-grade (markKnown, suspend, etc.) fanno full rebuild, il server
restituisce `queueCardIds` aggiornato. Il client deve sincronizzarlo:

```ts
function runSessionUpdate(loadNextData: () => Promise<ReviewPageData>) {
  setClientError(null);
  startTransition(() => {
    void loadNextData()
      .then((nextData) => {
        setViewData(nextData);
        // Se il server ha mandato una nuova lista, sincronizza
        if (nextData.queueCardIds.length > 0) {
          setQueueCardIds(nextData.queueCardIds);
        }
      })
      .catch((error) => { /* ... */ });
  });
}
```

#### 6e. Le altre azioni (markKnown, suspend, reset, setLearning) restano invariate

Queste azioni continuano a usare il full rebuild (tramite
`requireReviewPageDataForScope`). Il fast path è solo per il grade.

Non modificare `handleMarkKnown`, `handleSetLearning`, `handleResetCard`,
`handleToggleSuspended` — continuano a chiamare le rispettive session actions
che fanno full rebuild e restituiscono `ReviewPageData` con `queueCardIds`
aggiornato.

### Step 7: Gestire `position` e `remainingCount` nel rendering

Oggi il client usa `viewData.selectedCardContext.position` e
`viewData.selectedCardContext.remainingCount`. Questi vengono dal server.

Nel fast path, il server non può calcolarli (non ha la queue). Quindi il client
deve calcolarli dalla lista locale.

In `review-page-client.tsx`, cambia i riferimenti:

```ts
// PRIMA:
viewData.selectedCardContext.position
viewData.selectedCardContext.remainingCount

// DOPO:
// Usa i valori calcolati localmente (vedi 6b)
position   // calcolato da queueCardIds.indexOf(selectedCard.id)
remainingCount // calcolato da queueCardIds.length - index - 1
```

Questo vale per:
- Riga ~92: `position: viewData.selectedCardContext.position` →
  `position: position` (nel `buildCanonicalReviewSessionHrefForBase`)
- Riga ~314: `viewData.selectedCardContext.remainingCount` →
  `remainingCount`
- Riga ~317: stessa cosa

### Step 8: Gestire la fine della queue

Quando `nextCardId` è `undefined` (la queue è finita), il server non ha una card
da hydrare. In quel caso:

```ts
// Nel server:
if (!input.nextCardId) {
  // Queue esaurita — restituisci un ReviewPageData senza card selezionata
  return {
    // ... media, settings dalla sessione ...
    queue: buildIncrementalQueueUpdate(input.sessionQueue, input.gradedCardBucket),
    queueCardIds: [],
    selectedCard: null,
    selectedCardContext: {
      bucket: null,
      gradePreviews: [],
      isQueueCard: false,
      position: null,
      remainingCount: 0,
      showAnswer: false
    },
    session: {
      answeredCount: input.answeredCount + 1,
      extraNewCount: input.extraNewCount
    }
  };
}
```

Il client mostrerà lo stato di completamento (il codice esiste già:
`showCompletionState = !hasQueue && selectedCard === null`).

## Riepilogo delle modifiche

| File | Modifica |
|---|---|
| `src/lib/review.ts` | Aggiungere `queueCardIds: string[]` a `ReviewPageData` type; popolarlo in `buildReviewPageDataFromWorkspace` da `queueSnapshot.queueModels` |
| `src/actions/review.ts` | Aggiungere campi sessione a `ReviewSessionInput`; refactorare `gradeReviewCardSessionAction` con fast path + fallback; aggiungere `buildIncrementalQueueUpdate`; importare `hydrateReviewCard` |
| `src/components/review/review-page-client.tsx` | Aggiungere stato `queueCardIds`; mandare `nextCardId` + session data al grade; calcolare position/remaining localmente; sincronizzare su full rebuild |

## Vincoli

- Le form actions redirect-based (le prime 5 funzioni del file actions) **NON vanno
  toccate** — usano `redirect()` e il full rebuild va bene per loro
- Le session actions non-grade (`markLinkedEntryKnownSessionAction`,
  `setLinkedEntryLearningSessionAction`, `resetReviewCardSessionAction`,
  `setReviewCardSuspendedSessionAction`) **continuano a fare full rebuild** perché
  cambiano la composizione della queue
- `hydrateReviewCard` **non va modificata** — è già implementata e funzionante
- Il tipo `ReviewQueueCard` **non va modificato**
- Il pattern `runSessionUpdate` / `startTransition` / `setViewData` va preservato —
  funziona con React 18+ transitions e dà l'UI pending state
- `buildReviewGradePreviews` è importato nel client (`review-grade-previews.ts`) —
  non spostarlo
- **NON serve** inviare al client le card intere nella queue — solo gli ID

## Verifica

```bash
npx tsc --noEmit
npm run build
```

### Test manuale

1. **Grade veloce**: Apri la review, rispondi a 10+ card in sequenza
   → Ogni transizione deve essere percettibilmente più veloce
   → I conteggi (queueCount, dueCount) devono aggiornarsi correttamente
   → Il messaggio "N flashcard rimanenti" deve decrementare ad ogni grade
   → La barra di posizione nell'URL deve aggiornarsi

2. **Fine queue**: Rispondi a tutte le card in coda
   → Deve apparire lo stato di completamento ("La coda Review è vuota")
   → Il top-up "Aggiungi altre N nuove" deve funzionare (triggera full rebuild)

3. **Azione non-grade**: Durante la sessione, fai "Mark as known" su una card
   → Deve fare full rebuild (più lento del grade, ma corretto)
   → I conteggi e la lista devono ri-sincronizzarsi
   → La prossima card deve apparire correttamente

4. **Suspend/Resume**: Sospendi una card, poi fai un grade
   → La card sospesa non deve apparire nella lista locale
   → I conteggi devono essere coerenti

5. **URL session**: Copia l'URL durante la sessione, incollalo in una nuova tab
   → Deve caricare la pagina corretta (full rebuild, non fast path)

6. **Error recovery**: Simula un errore di rete durante il grade
   → Il client deve mostrare il messaggio di errore
   → La lista locale non deve andare in uno stato inconsistente

### Performance check

Misura il tempo di risposta (tab Network) per:
- Grade con fast path: obiettivo < 100ms
- Grade con full rebuild (fallback): il tempo attuale (~200-800ms)
- Rapporto atteso: 5-10× improvement
