# New Product Onboarding (gioco esistente)

1. Crea cartella prodotto:
   - `content/games/<game-slug>/products/<product-slug>/meta/product.json`
   - `content/games/<game-slug>/products/<product-slug>/units/units.json`
   - `content/games/<game-slug>/products/<product-slug>/lessons/*.mdx`
2. Usa il template in `content/templates/products/product.template.json`.
3. Ogni unità deve avere `requiredItemIds` non vuoto e riferimenti item canonici.
4. Aggiungi lezioni product-layer con frontmatter coerente (`layer: product`, `gameId`, `productId`).
5. Esegui:
   - `npm run content:validate`
   - `npm run content:build-index`
6. Verifica pagine:
   - `/games/<game-id>/products/<product-id>`
   - `/games/<game-id>/products/<product-id>/units/<unit-id>`
