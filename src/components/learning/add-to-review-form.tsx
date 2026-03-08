import { seedItemForReview } from "@/app/review/actions";

export function AddToReviewForm({ itemId, compact = false }: { itemId: string; compact?: boolean }) {
  return (
    <form action={seedItemForReview}>
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        className={
          compact
            ? "rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
            : "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
        }
      >
        Aggiungi a review
      </button>
    </form>
  );
}
