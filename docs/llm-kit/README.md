# LLM Content Kit

## Scopo

Questa cartella raccoglie in un solo posto tutto cio che serve per lavorare con
l'LLM esterno che produce contenuti importabili.

Serve come pacchetto operativo pronto da passare all'altro modello senza dover
cercare file in cartelle diverse.

## Struttura

- `general/`
  contiene i documenti che vanno passati sempre, indipendentemente dal media.
- `media/<media-slug>/`
  contiene brief e prompt specifici di un singolo media o batch.

## Kit generale

Da passare sempre:

- `general/01-content-format.md`
- `general/02-llm-content-handoff.md`
- `general/03-template-media.md`
- `general/04-template-textbook-lesson.md`
- `general/05-template-cards-file.md`
- `general/06-content-workflow-playbook.md`

## Kit media-specifico attuale

Disponibile ora:

- `media/duel-masters-dm25/01-brief.md`
- `media/duel-masters-dm25/02-batch-1-prompt.md`

## Uso pratico

### Se vuoi dare contesto completo

Passa:

- tutti i file di `general/`
- i file della cartella `media/<media-slug>/` su cui stai lavorando

### Se vuoi fare il primo batch Duel Masters

Passa almeno:

- `general/01-content-format.md`
- `general/02-llm-content-handoff.md`
- `general/03-template-media.md`
- `general/04-template-textbook-lesson.md`
- `general/05-template-cards-file.md`
- `general/06-content-workflow-playbook.md`
- `media/duel-masters-dm25/01-brief.md`
- `media/duel-masters-dm25/02-batch-1-prompt.md`

## Nota su Allineamento Template

> [!IMPORTANT]
> **Sincronizzazione Strutturale**
> Questo kit operativo è la "fonte di verità" per l'LLM quando deve produrre contenuti.
> **Ogni volta che si modifica la struttura dei dati dell'app** (es. aggiungendo nuovi campi opzionali a `:::card`, `:::term` o `:::grammar`, o cambiando la struttura di `media.md`), **quelle modifiche devono essere immediatamente replicate nei template di questa cartella** (in `general/01-content-format.md`, `02-llm-content-handoff.md` e nei file di `general/`). 
> Se l'LLM kit non viene tenuto allineato al codice e ai parser dell'applicazione, il modello di AI genererà contenuti obsoleti o non compatibili che falliranno l'import.

## Nota Storica sulle Fixtures

Questa cartella è un kit operativo. I documenti originali nel resto di `docs/` restano la sorgente di riferimento del progetto. Il bundle reale valido da usare come base operativa è `content/media/duel-masters-dm25`.
