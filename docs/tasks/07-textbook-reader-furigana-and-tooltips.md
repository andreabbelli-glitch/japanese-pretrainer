# Task 07 - Textbook Reader, Furigana And Tooltips

## Tipo

Frontend / reading experience

## Obiettivo

Implementare l'esperienza di studio del textbook, che e il cuore del prodotto.

## Input

- `01`
- `05`
- `06`

## Scope

- pagina elenco lesson;
- reader di una lesson;
- rendering di `lesson_content.html_rendered` o AST;
- controllo furigana con modalita `on`, `off`, `hover`;
- tooltip interattivi per `term` e `grammar`;
- comportamento mobile con sheet o popover;
- tracking apertura/completamento lesson.

## Deliverable

- reader leggibile e responsive;
- toggle furigana persistente;
- tooltip coerenti desktop/mobile;
- lesson rail o navigazione contestuale;
- stato completamento lesson.

## Dipendenze

- `05`
- `06`

## Criteri di accettazione

- il testo giapponese resta leggibile in tutte le modalita di furigana;
- i tooltip sono rapidi e non coprono il contenuto in modo aggressivo;
- su mobile l'interazione non dipende dall'hover;
- il reader supporta contenuti lunghi senza degradare l'uso.

## Note UX

Questo task deve risultare piacevole da leggere per sessioni lunghe. Spaziature,
larghezza di colonna, gerarchia tipografica e contrasto contano piu di qualunque
decorazione.
