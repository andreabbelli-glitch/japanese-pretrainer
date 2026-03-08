import type { LanguageItem, StudyItem } from "@/src/domain/content/types";
import type { ReviewTemplate } from "@/src/domain/review/types";

const TEMPLATE_BY_STUDY_TYPE: Record<StudyItem["type"], ReviewTemplate> = {
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

const TEMPLATE_BY_LANGUAGE_KIND: Record<LanguageItem["kind"], ReviewTemplate> = {
  kanji: TEMPLATE_BY_STUDY_TYPE.kanji,
  vocab: TEMPLATE_BY_STUDY_TYPE.vocab,
  verb: TEMPLATE_BY_STUDY_TYPE.vocab,
  adjective: TEMPLATE_BY_STUDY_TYPE.vocab,
  pattern: TEMPLATE_BY_STUDY_TYPE.pattern,
  keyword: TEMPLATE_BY_STUDY_TYPE.keyword,
  counter: TEMPLATE_BY_STUDY_TYPE.vocab,
  phrase: TEMPLATE_BY_STUDY_TYPE.vocab,
  "function-word": TEMPLATE_BY_STUDY_TYPE.pattern,
};

export function getReviewTemplate(item: StudyItem | LanguageItem): ReviewTemplate {
  if ("type" in item) {
    return TEMPLATE_BY_STUDY_TYPE[item.type];
  }

  return TEMPLATE_BY_LANGUAGE_KIND[item.kind];
}
