# New Game Onboarding (nuovo contesto)

1. Crea:
   - `content/games/<game-slug>/meta/game.json`
   - `content/games/<game-slug>/lessons/*.mdx` (opzionale ma consigliato)
   - `content/games/<game-slug>/products/<product-slug>/...`
2. Usa i template:
   - `content/templates/games/game.template.json`
   - `content/templates/products/product.template.json`
3. Mantieni separazione: item linguistici canonici in `content/language/items/items.json`.
4. Per goal DB product/unit usa `target_id`:
   - product: `<gameId>::<productId>`
   - unit: `<gameId>::<productId>::<unitId>`
5. Esegui quality checks:
   - `npm run content:validate`
   - `npm run lint && npm run typecheck && npm run test && npm run build`
