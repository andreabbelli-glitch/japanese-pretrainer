import DeckDetailPage from "@/app/decks/[slug]/page";

export default function DeckSD2Page() {
  return <DeckDetailPage params={Promise.resolve({ slug: "dm25-sd2" })} />;
}
