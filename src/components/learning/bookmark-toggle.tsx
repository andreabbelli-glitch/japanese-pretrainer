import { addCardBookmark, removeCardBookmark } from "@/app/cards/[slug]/bookmark-actions";

export function BookmarkToggle({ cardId, slug, isBookmarked }: { cardId: string; slug: string; isBookmarked: boolean }) {
  return isBookmarked ? (
    <form action={removeCardBookmark}>
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
        ★ Rimuovi dai preferiti
      </button>
    </form>
  ) : (
    <form action={addCardBookmark}>
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900">
        ☆ Aggiungi ai preferiti
      </button>
    </form>
  );
}
