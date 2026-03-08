import DeckDetailPage from "@/app/decks/[slug]/page";

export default function DeckSD1Page() {
  return <DeckDetailPage params={Promise.resolve({ slug: "dm25-sd1" })} />;
}
