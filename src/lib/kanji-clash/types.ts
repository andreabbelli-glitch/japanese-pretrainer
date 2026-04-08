export type KanjiClashEligibleReviewState = "review" | "relearning";

export type KanjiClashSubjectSource =
  | {
      type: "entry";
      entryId: string;
    }
  | {
      type: "group";
      crossMediaGroupId: string;
    };

export type KanjiClashEligibleSubjectMember = {
  entryId: string;
  lemma: string;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  reading: string;
};

export type KanjiClashEligibleSubject = {
  entryType: "term";
  kanji: string[];
  label: string;
  members: KanjiClashEligibleSubjectMember[];
  reading: string | null;
  readingForms: string[];
  reps: number;
  reviewState: KanjiClashEligibleReviewState;
  source: KanjiClashSubjectSource;
  stability: number;
  subjectKey: string;
  surfaceForms: string[];
};

export type KanjiClashCandidate = {
  left: KanjiClashEligibleSubject;
  leftSubjectKey: string;
  pairKey: string;
  right: KanjiClashEligibleSubject;
  rightSubjectKey: string;
  score: number;
  sharedKanji: string[];
};
