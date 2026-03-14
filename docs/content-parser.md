# Content Parser And Validator

Il layer contenuti vive in `src/lib/content`.

Espone due entry point:

- `parseMediaDirectory(mediaDir)`: legge una directory `content/media/<slug>` e
  restituisce un bundle normalizzato con issue strutturate.
- `parseContentRoot(contentRoot)`: scansiona `contentRoot/media/*` e aggrega piu
  bundle.

Entrambe le funzioni restituiscono:

```ts
type ContentParseResult<T> = {
  ok: boolean;
  data: T;
  issues: ValidationIssue[];
};
```

`ok` e `true` solo quando non ci sono errori. `data` viene comunque popolato
anche in caso di input invalido, cosi il futuro importer o il workflow di
correzione LLM possono ispezionare il parse parziale senza ripetere il parsing.

## Cosa produce

Il bundle normalizzato include:

- media, lesson e cards file con frontmatter tipizzato;
- AST Markdown normalizzato con paragrafi, heading, liste, blocchi `term`,
  `grammar`, `card`, `example_sentence` e `image`;
- riferimenti semanticamente raccolti;
- furigana parse-ati come nodi dedicati;
- array canonici di `terms`, `grammarPatterns` e `cards`.

## Tipi di issue

Le issue usano quattro categorie:

- `syntax`: YAML invalido, blocchi non chiusi, furigana malformati;
- `schema`: campi mancanti, tipi errati, campi sconosciuti, blocchi non ammessi;
- `reference`: link o `entry_id` che puntano a ID inesistenti;
- `integrity`: duplicate ID, incoerenze tra file o bundle incompleti
  (`media.md`, `textbook/`, `cards/` mancanti o directory senza file `.md`,
  asset immagine mancanti).

Ogni issue contiene `code`, `message`, `location.filePath` e, quando
disponibile, `location.range`.

## Uso minimo

```ts
import { parseMediaDirectory } from "@/lib/content";

const result = await parseMediaDirectory("/abs/path/content/media/sample-anime");

if (!result.ok) {
  console.error(result.issues);
}

console.log(result.data.terms);
```

## CLI di validazione

Validazione dell'intero content root:

```sh
./scripts/with-node.sh pnpm content:validate -- --content-root ./content
```

Validazione di un singolo media bundle:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25
```

Questo comando riusa lo stesso parser/validator del runtime e fallisce con exit
code `1` se trova issue di tipo `syntax`, `schema`, `reference` o `integrity`.

## Note

- Il parser non importa nulla nel database.
- Un media bundle e considerato valido solo se include `media.md`, `textbook/` e
  `cards/`; entrambe le directory devono esistere e contenere almeno un file
  Markdown.
- I blocchi `:::image` nei lesson sono validi solo se `src` punta a un file
  reale sotto `content/media/<slug>/assets/`.
- I file cards sono volutamente strict: accettano solo blocchi strutturati.
- Il payload e pensato per essere consumato dal Task 05 senza dover riparse-are
  il Markdown grezzo.
