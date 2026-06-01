import type {
  KatakanaSpeedConfusionCluster,
  KatakanaSpeedItem,
  KatakanaSpeedTier
} from "../types.ts";

export type KatakanaSpeedStaticItemRow = {
  readonly family: string;
  readonly id: string;
  readonly kind: KatakanaSpeedItem["kind"];
  readonly rarity: KatakanaSpeedItem["rarity"];
  readonly reading: string;
  readonly surface: string;
  readonly tier: KatakanaSpeedTier;
};

export type KatakanaSpeedManualWordRow = {
  readonly focusChunks: readonly string[];
  readonly id: string;
  readonly meaningIt: string;
  readonly surface: string;
  readonly tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">;
};

export type KatakanaSpeedStaticClusterRow = {
  readonly id: string;
  readonly itemIds: readonly string[];
  readonly kind: KatakanaSpeedConfusionCluster["kind"];
};

export const KATAKANA_SPEED_B_TIER_CHUNKS = [
  "イェ",
  "ウィ",
  "ウェ",
  "ウォ",
  "クァ",
  "クィ",
  "クェ",
  "クォ",
  "グァ",
  "ツィ",
  "トゥ",
  "ドゥ",
  "ヴァ",
  "ヴィ",
  "ヴ",
  "ヴェ",
  "ヴォ",
  "テュ",
  "フュ",
  "ヴュ"
] as const;

export const KATAKANA_SPEED_C_TIER_CHUNKS = [
  "スィ",
  "ズィ",
  "グィ",
  "グェ",
  "グォ",
  "キェ",
  "ギェ",
  "ニェ",
  "ヒェ",
  "ビェ",
  "ピェ",
  "フョ",
  "ヴョ"
] as const;

export const KATAKANA_SPEED_OPERATIONAL_FOCUS_CHUNKS = [
  "シェ",
  "ジェ",
  "チェ",
  "ツァ",
  "ツィ",
  "ツェ",
  "ツォ",
  "ティ",
  "ディ",
  "デュ",
  "テュ",
  "トゥ",
  "ドゥ",
  "ファ",
  "フィ",
  "フェ",
  "フォ",
  "フュ",
  "フョ",
  "イェ",
  "ウィ",
  "ウェ",
  "ウォ",
  "クァ",
  "クィ",
  "クェ",
  "クォ",
  "グァ",
  "グィ",
  "グェ",
  "グォ",
  "ヴァ",
  "ヴィ",
  "ヴェ",
  "ヴォ",
  "ヴュ",
  "ヴョ",
  "スィ",
  "ズィ",
  "キェ",
  "ギェ",
  "ニェ",
  "ヒェ",
  "ビェ",
  "ピェ"
] as const;

export const KATAKANA_SPEED_STATIC_ITEM_ROWS = [
  staticItem(
    "chunk-she",
    "シェ",
    "she",
    "sibilant-e",
    "extended_chunk",
    "core",
    "A"
  ),
  staticItem(
    "chunk-je",
    "ジェ",
    "je",
    "sibilant-e",
    "extended_chunk",
    "core",
    "A"
  ),
  staticItem(
    "chunk-che",
    "チェ",
    "che",
    "sibilant-e",
    "extended_chunk",
    "core",
    "A"
  ),
  staticItem("chunk-tsa", "ツァ", "tsa", "ts", "extended_chunk", "rare", "A"),
  staticItem("chunk-tse", "ツェ", "tse", "ts", "extended_chunk", "rare", "A"),
  staticItem("chunk-tso", "ツォ", "tso", "ts", "extended_chunk", "rare", "A"),
  staticItem("chunk-ti", "ティ", "ti", "t-d", "extended_chunk", "core", "A"),
  staticItem("chunk-di", "ディ", "di", "t-d", "extended_chunk", "core", "A"),
  staticItem("chunk-tu", "トゥ", "tu", "t-d", "extended_chunk", "edge", "B"),
  staticItem("chunk-du", "ドゥ", "du", "t-d", "extended_chunk", "edge", "B"),
  staticItem("chunk-dyu", "デュ", "dyu", "t-d", "extended_chunk", "edge", "A"),
  staticItem("chunk-tyu", "テュ", "tyu", "t-d", "extended_chunk", "rare", "B"),
  staticItem("chunk-fa", "ファ", "fa", "f", "extended_chunk", "core", "A"),
  staticItem("chunk-fi", "フィ", "fi", "f", "extended_chunk", "core", "A"),
  staticItem("chunk-fe", "フェ", "fe", "f", "extended_chunk", "core", "A"),
  staticItem("chunk-fo", "フォ", "fo", "f", "extended_chunk", "core", "A"),
  staticItem("chunk-fyu", "フュ", "fyu", "f", "extended_chunk", "rare", "B"),
  staticItem("chunk-ye", "イェ", "ye", "w", "extended_chunk", "rare", "B"),
  staticItem("chunk-wi", "ウィ", "wi", "w", "extended_chunk", "edge", "B"),
  staticItem("chunk-we", "ウェ", "we", "w", "extended_chunk", "core", "B"),
  staticItem("chunk-wo", "ウォ", "wo", "w", "extended_chunk", "core", "B"),
  staticItem(
    "chunk-kwa",
    "クァ",
    "kwa",
    "kw-gw",
    "extended_chunk",
    "rare",
    "B"
  ),
  staticItem(
    "chunk-kwi",
    "クィ",
    "kwi",
    "kw-gw",
    "extended_chunk",
    "rare",
    "B"
  ),
  staticItem(
    "chunk-kwe",
    "クェ",
    "kwe",
    "kw-gw",
    "extended_chunk",
    "rare",
    "B"
  ),
  staticItem(
    "chunk-kwo",
    "クォ",
    "kwo",
    "kw-gw",
    "extended_chunk",
    "rare",
    "B"
  ),
  staticItem(
    "chunk-gwa",
    "グァ",
    "gwa",
    "kw-gw",
    "extended_chunk",
    "rare",
    "B"
  ),
  staticItem("chunk-tsi", "ツィ", "tsi", "ts", "extended_chunk", "rare", "B"),
  staticItem("chunk-va", "ヴァ", "va", "v", "extended_chunk", "edge", "B"),
  staticItem("chunk-vi", "ヴィ", "vi", "v", "extended_chunk", "edge", "B"),
  staticItem("chunk-vu", "ヴ", "vu", "v", "extended_chunk", "rare", "B"),
  staticItem("chunk-ve", "ヴェ", "ve", "v", "extended_chunk", "edge", "B"),
  staticItem("chunk-vo", "ヴォ", "vo", "v", "extended_chunk", "edge", "B"),
  staticItem("chunk-vyu", "ヴュ", "vyu", "v", "extended_chunk", "rare", "B"),
  staticItem("chunk-si", "スィ", "si", "c-tier", "extended_chunk", "rare", "C"),
  staticItem("chunk-zi", "ズィ", "zi", "c-tier", "extended_chunk", "rare", "C"),
  staticItem(
    "chunk-gwi",
    "グィ",
    "gwi",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-gwe",
    "グェ",
    "gwe",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-gwo",
    "グォ",
    "gwo",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-kye",
    "キェ",
    "kye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-gye",
    "ギェ",
    "gye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-nye",
    "ニェ",
    "nye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-hye",
    "ヒェ",
    "hye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-bye",
    "ビェ",
    "bye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-pye",
    "ピェ",
    "pye",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-fyo",
    "フョ",
    "fyo",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "chunk-vyo",
    "ヴョ",
    "vyo",
    "c-tier",
    "extended_chunk",
    "rare",
    "C"
  ),
  staticItem(
    "kana-shi",
    "シ",
    "shi",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-tsu",
    "ツ",
    "tsu",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-so",
    "ソ",
    "so",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-n",
    "ン",
    "n",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-no",
    "ノ",
    "no",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-me",
    "メ",
    "me",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-nu",
    "ヌ",
    "nu",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-wa",
    "ワ",
    "wa",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-u",
    "ウ",
    "u",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-fu",
    "フ",
    "fu",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ko",
    "コ",
    "ko",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ro",
    "ロ",
    "ro",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-yu",
    "ユ",
    "yu",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-yo",
    "ヨ",
    "yo",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ma",
    "マ",
    "ma",
    "visual-ma-mu",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-mu",
    "ム",
    "mu",
    "visual-ma-mu",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ra",
    "ラ",
    "ra",
    "visual-ra-fu-wo-wa",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-wo",
    "ヲ",
    "wo",
    "visual-ra-fu-wo-wa",
    "single_kana",
    "edge",
    "visual"
  ),
  staticItem(
    "kana-ta",
    "タ",
    "ta",
    "visual-ta-ku-ke",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ke",
    "ケ",
    "ke",
    "visual-ta-ku-ke",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ha",
    "ハ",
    "ha",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ba",
    "バ",
    "ba",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-pa",
    "パ",
    "pa",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ka",
    "カ",
    "ka",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-ga",
    "ガ",
    "ga",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-za",
    "ザ",
    "za",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-te",
    "テ",
    "te",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "kana-de",
    "デ",
    "de",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  staticItem(
    "mark-long-vowel",
    "ー",
    "long",
    "visual-long-vowel-mark",
    "core_mora",
    "core",
    "mora"
  ),
  staticItem(
    "mark-horizontal-one",
    "一",
    "one",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  staticItem(
    "mark-horizontal-dash",
    "－",
    "dash",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  staticItem(
    "mark-vertical-bar",
    "|",
    "bar",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  staticItem("mora-sa", "サ", "sa", "basic", "core_mora", "core", "mora"),
  staticItem("mora-i", "イ", "i", "basic", "core_mora", "core", "mora"),
  staticItem("mora-to", "ト", "to", "basic", "core_mora", "core", "mora"),
  staticItem("mora-ku", "ク", "ku", "basic", "core_mora", "core", "mora")
] as const satisfies readonly KatakanaSpeedStaticItemRow[];

export const KATAKANA_SPEED_MANUAL_WORD_ROWS = [
  manualWord("word-security", "セキュリティ", "A", ["ティ"], "sicurezza"),
  manualWord("word-feedback", "フィードバック", "A", ["フィ"], "feedback"),
  manualWord(
    "word-discussion",
    "ディスカッション",
    "A",
    ["ディ"],
    "discussione"
  ),
  manualWord("word-producer", "プロデューサー", "A", ["デュ"], "produttore"),
  manualWord("word-share", "シェア", "A", ["シェ"], "condivisione"),
  manualWord("word-check", "チェック", "A", ["チェ"], "controllo"),
  manualWord("word-pizza", "ピッツァ", "A", ["ツァ"], "pizza"),
  manualWord("word-florence", "フィレンツェ", "A", ["フィ", "ツェ"], "Firenze"),
  manualWord("word-canzone", "カンツォーネ", "A", ["ツォ"], "canzone"),
  manualWord("word-window", "ウィンドウ", "B", ["ウィ"], "finestra"),
  manualWord("word-website", "ウェブサイト", "B", ["ウェ"], "sito web"),
  manualWord("word-wallet", "ウォレット", "B", ["ウォ"], "portafoglio"),
  manualWord("word-quartet", "クァルテット", "B", ["クァ"], "quartetto"),
  manualWord("word-quarter", "クォーター", "B", ["クォ"], "quarto"),
  manualWord("word-hindu", "ヒンドゥー", "B", ["ドゥ"], "induismo"),
  manualWord("word-violin-v", "ヴァイオリン", "B", ["ヴァ"], "violino"),
  manualWord("word-venus", "ヴィーナス", "B", ["ヴィ"], "Venere"),
  manualWord("word-venice", "ヴェネツィア", "B", ["ヴェ", "ツィ"], "Venezia"),
  manualWord("word-vocal", "ヴォーカル", "B", ["ヴォ"], "vocale"),
  manualWord("word-fusion", "フュージョン", "B", ["フュ"], "fusion"),
  manualWord("word-interview-v", "インタヴュー", "B", ["ヴュ"], "intervista"),
  manualWord(
    "word-kierkegaard",
    "キェルケゴール",
    "C",
    ["キェ"],
    "Kierkegaard"
  ),
  manualWord("word-si-rare", "スィート", "C", ["スィ"], "sweet"),
  manualWord("word-gwe-rare", "グェルフ", "C", ["グェ"], "Guelfo")
] as const satisfies readonly KatakanaSpeedManualWordRow[];

export const KATAKANA_SPEED_STATIC_CLUSTER_ROWS = [
  staticCluster("visual-shi-tsu-so-n", "visual", [
    "kana-shi",
    "kana-tsu",
    "kana-so",
    "kana-n"
  ]),
  staticCluster("visual-no-me-nu", "visual", ["kana-no", "kana-me", "kana-nu"]),
  staticCluster("visual-wa-u-fu-ku", "visual", [
    "kana-wa",
    "kana-u",
    "kana-fu",
    "mora-ku"
  ]),
  staticCluster("visual-ko-ro-yu-yo", "visual", [
    "kana-ko",
    "kana-ro",
    "kana-yu",
    "kana-yo"
  ]),
  staticCluster("visual-ma-mu", "visual", ["kana-ma", "kana-mu"]),
  staticCluster("visual-ra-fu-wo-wa", "visual", [
    "kana-ra",
    "kana-fu",
    "kana-wo",
    "kana-wa"
  ]),
  staticCluster("visual-ta-ku-ke", "visual", ["kana-ta", "mora-ku", "kana-ke"]),
  staticCluster("visual-ha-ba-pa", "visual", ["kana-ha", "kana-ba", "kana-pa"]),
  staticCluster("visual-dakuon-core", "visual", [
    "kana-ka",
    "kana-ga",
    "mora-sa",
    "kana-za",
    "kana-te",
    "kana-de"
  ]),
  staticCluster("visual-long-vowel-mark", "visual", [
    "mark-long-vowel",
    "mark-horizontal-one",
    "mark-horizontal-dash",
    "mark-vertical-bar"
  ]),
  staticCluster("phonological-ti-di", "phonological", ["chunk-ti", "chunk-di"]),
  staticCluster("phonological-tu-du", "phonological", ["chunk-tu", "chunk-du"]),
  staticCluster("phonological-fa-va", "phonological", ["chunk-fa", "chunk-va"]),
  staticCluster("phonological-fi-vi", "phonological", ["chunk-fi", "chunk-vi"]),
  staticCluster("phonological-fe-ve", "phonological", ["chunk-fe", "chunk-ve"]),
  staticCluster("phonological-fo-vo", "phonological", ["chunk-fo", "chunk-vo"]),
  staticCluster("phonological-ts", "phonological", [
    "chunk-tsa",
    "chunk-tse",
    "chunk-tso"
  ]),
  staticCluster("phonological-kw", "phonological", [
    "chunk-kwa",
    "chunk-kwi",
    "chunk-kwe",
    "chunk-kwo"
  ]),
  staticCluster("phonological-v-family", "phonological", [
    "chunk-va",
    "chunk-vi",
    "chunk-ve",
    "chunk-vo",
    "chunk-vyu"
  ])
] as const satisfies readonly KatakanaSpeedStaticClusterRow[];

function staticItem(
  id: string,
  surface: string,
  reading: string,
  family: string,
  kind: KatakanaSpeedItem["kind"],
  rarity: KatakanaSpeedItem["rarity"],
  tier: KatakanaSpeedTier
): KatakanaSpeedStaticItemRow {
  return {
    family,
    id,
    kind,
    rarity,
    reading,
    surface,
    tier
  };
}

function manualWord(
  id: string,
  surface: string,
  tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">,
  focusChunks: readonly string[],
  meaningIt: string
): KatakanaSpeedManualWordRow {
  return {
    focusChunks,
    id,
    meaningIt,
    surface,
    tier
  };
}

function staticCluster(
  id: string,
  kind: KatakanaSpeedConfusionCluster["kind"],
  itemIds: readonly string[]
): KatakanaSpeedStaticClusterRow {
  return {
    id,
    itemIds,
    kind
  };
}
