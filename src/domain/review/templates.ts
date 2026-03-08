import type { StudyItem } from "@/src/domain/content/types";
import type { ReviewTemplate } from "@/src/domain/review/types";

const TEMPLATE_BY_TYPE: Record<StudyItem["type"], ReviewTemplate> = {
  kanji: {
    promptLabel: "Kanji",
    answerLabel: "Lettura + significato",
  },
  vocab: {
    promptLabel: "Parola / verbo",
    answerLabel: "Lettura + spiegazione",
  },
  keyword: {
    promptLabel: "Keyword di gioco",
    answerLabel: "Effetto pratico in partita",
  },
  pattern: {
    promptLabel: "Pattern del testo carta",
    answerLabel: "Come riconoscerlo e cosa segnala",
  },
};

export function getReviewTemplate(item: StudyItem): ReviewTemplate {
  return TEMPLATE_BY_TYPE[item.type];
}
