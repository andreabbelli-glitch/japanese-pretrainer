import { PlaceholderPage } from "@/components/placeholder-page";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      kicker="Preferenze locali"
      sections={[
        {
          title: "Furigana e comportamento di studio",
          body: "Le preferenze esistono già a livello dati, ma la schermata completa resta fuori scope finché non arrivano reader, glossary e progress."
        },
        {
          title: "Base pronta",
          body: "L’app shell è costruita in modo che future impostazioni non richiedano refactor del layout globale o della navigazione."
        }
      ]}
      summary="Le impostazioni complete arriveranno più avanti. Per ora questa rotta resta un punto stabile nella shell applicativa."
      title="Settings"
    />
  );
}
