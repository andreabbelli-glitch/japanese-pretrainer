import type {
  KatakanaSpeedConfusionCluster,
  KatakanaSpeedItem,
  KatakanaSpeedTier
} from "../types.ts";
import {
  countKatakanaMora,
  tokenizeKatakanaDisplaySegments
} from "./tokenizer.ts";
import {
  buildKatakanaSpeedPseudowordCatalog,
  buildKatakanaSpeedPseudowordConfusionClusters,
  type KatakanaSpeedPseudowordCatalogDefinition
} from "./pseudoword-catalog.ts";
import { getKatakanaSpeedOperationalWordSurfaces } from "./exercise-catalog.ts";

export {
  generateKatakanaSpeedPseudoWord,
  generateKatakanaSpeedPseudoWords
} from "./pseudo.ts";

type CatalogItemDefinition = Omit<
  KatakanaSpeedItem,
  "confusionClusterIds" | "distractorItemIds"
>;

type ItemOptions = {
  readonly focusChunks?: readonly string[];
  readonly isPseudo?: boolean;
  readonly meaningIt?: string;
  readonly sentenceId?: string;
  readonly tags?: readonly string[];
  readonly targetRtMs?: number;
};

const B_TIER_CHUNKS = new Set([
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
]);

const C_TIER_CHUNKS = new Set([
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
]);

const MANUAL_WORD_SURFACES = new Set([
  "セキュリティ",
  "フィードバック",
  "ディスカッション",
  "プロデューサー",
  "シェア",
  "チェック",
  "ピッツァ",
  "フィレンツェ",
  "カンツォーネ",
  "ウィンドウ",
  "ウェブサイト",
  "ウォレット",
  "クァルテット",
  "クォーター",
  "ヒンドゥー",
  "ヴァイオリン",
  "ヴィーナス",
  "ヴェネツィア",
  "ヴォーカル",
  "フュージョン",
  "インタヴュー",
  "キェルケゴール",
  "スィート",
  "グェルフ"
]);

const OPERATIONAL_FOCUS_CHUNKS = [
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

const itemDefinitions = [
  item("chunk-she", "シェ", "she", "sibilant-e", "extended_chunk", "core", "A"),
  item("chunk-je", "ジェ", "je", "sibilant-e", "extended_chunk", "core", "A"),
  item("chunk-che", "チェ", "che", "sibilant-e", "extended_chunk", "core", "A"),
  item("chunk-tsa", "ツァ", "tsa", "ts", "extended_chunk", "rare", "A"),
  item("chunk-tse", "ツェ", "tse", "ts", "extended_chunk", "rare", "A"),
  item("chunk-tso", "ツォ", "tso", "ts", "extended_chunk", "rare", "A"),
  item("chunk-ti", "ティ", "ti", "t-d", "extended_chunk", "core", "A"),
  item("chunk-di", "ディ", "di", "t-d", "extended_chunk", "core", "A"),
  item("chunk-tu", "トゥ", "tu", "t-d", "extended_chunk", "edge", "B"),
  item("chunk-du", "ドゥ", "du", "t-d", "extended_chunk", "edge", "B"),
  item("chunk-dyu", "デュ", "dyu", "t-d", "extended_chunk", "edge", "A"),
  item("chunk-tyu", "テュ", "tyu", "t-d", "extended_chunk", "rare", "B"),
  item("chunk-fa", "ファ", "fa", "f", "extended_chunk", "core", "A"),
  item("chunk-fi", "フィ", "fi", "f", "extended_chunk", "core", "A"),
  item("chunk-fe", "フェ", "fe", "f", "extended_chunk", "core", "A"),
  item("chunk-fo", "フォ", "fo", "f", "extended_chunk", "core", "A"),
  item("chunk-fyu", "フュ", "fyu", "f", "extended_chunk", "rare", "B"),
  item("chunk-ye", "イェ", "ye", "w", "extended_chunk", "rare", "B"),
  item("chunk-wi", "ウィ", "wi", "w", "extended_chunk", "edge", "B"),
  item("chunk-we", "ウェ", "we", "w", "extended_chunk", "core", "B"),
  item("chunk-wo", "ウォ", "wo", "w", "extended_chunk", "core", "B"),
  item("chunk-kwa", "クァ", "kwa", "kw-gw", "extended_chunk", "rare", "B"),
  item("chunk-kwi", "クィ", "kwi", "kw-gw", "extended_chunk", "rare", "B"),
  item("chunk-kwe", "クェ", "kwe", "kw-gw", "extended_chunk", "rare", "B"),
  item("chunk-kwo", "クォ", "kwo", "kw-gw", "extended_chunk", "rare", "B"),
  item("chunk-gwa", "グァ", "gwa", "kw-gw", "extended_chunk", "rare", "B"),
  item("chunk-tsi", "ツィ", "tsi", "ts", "extended_chunk", "rare", "B"),
  item("chunk-va", "ヴァ", "va", "v", "extended_chunk", "edge", "B"),
  item("chunk-vi", "ヴィ", "vi", "v", "extended_chunk", "edge", "B"),
  item("chunk-vu", "ヴ", "vu", "v", "extended_chunk", "rare", "B"),
  item("chunk-ve", "ヴェ", "ve", "v", "extended_chunk", "edge", "B"),
  item("chunk-vo", "ヴォ", "vo", "v", "extended_chunk", "edge", "B"),
  item("chunk-vyu", "ヴュ", "vyu", "v", "extended_chunk", "rare", "B"),
  item("chunk-si", "スィ", "si", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-zi", "ズィ", "zi", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-gwi", "グィ", "gwi", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-gwe", "グェ", "gwe", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-gwo", "グォ", "gwo", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-kye", "キェ", "kye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-gye", "ギェ", "gye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-nye", "ニェ", "nye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-hye", "ヒェ", "hye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-bye", "ビェ", "bye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-pye", "ピェ", "pye", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-fyo", "フョ", "fyo", "c-tier", "extended_chunk", "rare", "C"),
  item("chunk-vyo", "ヴョ", "vyo", "c-tier", "extended_chunk", "rare", "C"),
  item(
    "kana-shi",
    "シ",
    "shi",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-tsu",
    "ツ",
    "tsu",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-so",
    "ソ",
    "so",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-n",
    "ン",
    "n",
    "visual-shi-tsu-so-n",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-no",
    "ノ",
    "no",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-me",
    "メ",
    "me",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-nu",
    "ヌ",
    "nu",
    "visual-no-me-nu",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-wa",
    "ワ",
    "wa",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-u",
    "ウ",
    "u",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-fu",
    "フ",
    "fu",
    "visual-wa-u-fu-ku",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ko",
    "コ",
    "ko",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ro",
    "ロ",
    "ro",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-yu",
    "ユ",
    "yu",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-yo",
    "ヨ",
    "yo",
    "visual-ko-ro-yu-yo",
    "single_kana",
    "core",
    "visual"
  ),
  item("kana-ma", "マ", "ma", "visual-ma-mu", "single_kana", "core", "visual"),
  item("kana-mu", "ム", "mu", "visual-ma-mu", "single_kana", "core", "visual"),
  item(
    "kana-ra",
    "ラ",
    "ra",
    "visual-ra-fu-wo-wa",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-wo",
    "ヲ",
    "wo",
    "visual-ra-fu-wo-wa",
    "single_kana",
    "edge",
    "visual"
  ),
  item(
    "kana-ta",
    "タ",
    "ta",
    "visual-ta-ku-ke",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ke",
    "ケ",
    "ke",
    "visual-ta-ku-ke",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ha",
    "ハ",
    "ha",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ba",
    "バ",
    "ba",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-pa",
    "パ",
    "pa",
    "visual-ha-ba-pa",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ka",
    "カ",
    "ka",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-ga",
    "ガ",
    "ga",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-za",
    "ザ",
    "za",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-te",
    "テ",
    "te",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "kana-de",
    "デ",
    "de",
    "visual-dakuon-core",
    "single_kana",
    "core",
    "visual"
  ),
  item(
    "mark-long-vowel",
    "ー",
    "long",
    "visual-long-vowel-mark",
    "core_mora",
    "core",
    "mora"
  ),
  item(
    "mark-horizontal-one",
    "一",
    "one",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  item(
    "mark-horizontal-dash",
    "－",
    "dash",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  item(
    "mark-vertical-bar",
    "|",
    "bar",
    "visual-long-vowel-mark",
    "core_mora",
    "rare",
    "mora"
  ),
  item("mora-sa", "サ", "sa", "basic", "core_mora", "core", "mora"),
  item("mora-i", "イ", "i", "basic", "core_mora", "core", "mora"),
  item("mora-to", "ト", "to", "basic", "core_mora", "core", "mora"),
  item("mora-ku", "ク", "ku", "basic", "core_mora", "core", "mora"),
  word("word-security", "セキュリティ", "A", ["ティ"], "sicurezza"),
  word("word-feedback", "フィードバック", "A", ["フィ"], "feedback"),
  word("word-discussion", "ディスカッション", "A", ["ディ"], "discussione"),
  word("word-producer", "プロデューサー", "A", ["デュ"], "produttore"),
  word("word-share", "シェア", "A", ["シェ"], "condivisione"),
  word("word-check", "チェック", "A", ["チェ"], "controllo"),
  word("word-pizza", "ピッツァ", "A", ["ツァ"], "pizza"),
  word("word-florence", "フィレンツェ", "A", ["フィ", "ツェ"], "Firenze"),
  word("word-canzone", "カンツォーネ", "A", ["ツォ"], "canzone"),
  word("word-window", "ウィンドウ", "B", ["ウィ"], "finestra"),
  word("word-website", "ウェブサイト", "B", ["ウェ"], "sito web"),
  word("word-wallet", "ウォレット", "B", ["ウォ"], "portafoglio"),
  word("word-quartet", "クァルテット", "B", ["クァ"], "quartetto"),
  word("word-quarter", "クォーター", "B", ["クォ"], "quarto"),
  word("word-hindu", "ヒンドゥー", "B", ["ドゥ"], "induismo"),
  word("word-violin-v", "ヴァイオリン", "B", ["ヴァ"], "violino"),
  word("word-venus", "ヴィーナス", "B", ["ヴィ"], "Venere"),
  word("word-venice", "ヴェネツィア", "B", ["ヴェ", "ツィ"], "Venezia"),
  word("word-vocal", "ヴォーカル", "B", ["ヴォ"], "vocale"),
  word("word-fusion", "フュージョン", "B", ["フュ"], "fusion"),
  word("word-interview-v", "インタヴュー", "B", ["ヴュ"], "intervista"),
  word("word-kierkegaard", "キェルケゴール", "C", ["キェ"], "Kierkegaard"),
  word("word-si-rare", "スィート", "C", ["スィ"], "sweet"),
  word("word-gwe-rare", "グェルフ", "C", ["グェ"], "Guelfo"),
  ...operationalWordDefinitions(),
  ...buildKatakanaSpeedPseudowordCatalog().map(pseudowordFromCatalog),
  ...sentenceDefinitions()
];

const clusterDefinitions = [
  cluster("visual-shi-tsu-so-n", "visual", [
    "kana-shi",
    "kana-tsu",
    "kana-so",
    "kana-n"
  ]),
  cluster("visual-no-me-nu", "visual", ["kana-no", "kana-me", "kana-nu"]),
  cluster("visual-wa-u-fu-ku", "visual", [
    "kana-wa",
    "kana-u",
    "kana-fu",
    "mora-ku"
  ]),
  cluster("visual-ko-ro-yu-yo", "visual", [
    "kana-ko",
    "kana-ro",
    "kana-yu",
    "kana-yo"
  ]),
  cluster("visual-ma-mu", "visual", ["kana-ma", "kana-mu"]),
  cluster("visual-ra-fu-wo-wa", "visual", [
    "kana-ra",
    "kana-fu",
    "kana-wo",
    "kana-wa"
  ]),
  cluster("visual-ta-ku-ke", "visual", ["kana-ta", "mora-ku", "kana-ke"]),
  cluster("visual-ha-ba-pa", "visual", ["kana-ha", "kana-ba", "kana-pa"]),
  cluster("visual-dakuon-core", "visual", [
    "kana-ka",
    "kana-ga",
    "mora-sa",
    "kana-za",
    "kana-te",
    "kana-de"
  ]),
  cluster("visual-long-vowel-mark", "visual", [
    "mark-long-vowel",
    "mark-horizontal-one",
    "mark-horizontal-dash",
    "mark-vertical-bar"
  ]),
  cluster("phonological-ti-di", "phonological", ["chunk-ti", "chunk-di"]),
  cluster("phonological-tu-du", "phonological", ["chunk-tu", "chunk-du"]),
  cluster("phonological-fa-va", "phonological", ["chunk-fa", "chunk-va"]),
  cluster("phonological-fi-vi", "phonological", ["chunk-fi", "chunk-vi"]),
  cluster("phonological-fe-ve", "phonological", ["chunk-fe", "chunk-ve"]),
  cluster("phonological-fo-vo", "phonological", ["chunk-fo", "chunk-vo"]),
  cluster("phonological-ts", "phonological", [
    "chunk-tsa",
    "chunk-tse",
    "chunk-tso"
  ]),
  cluster("phonological-kw", "phonological", [
    "chunk-kwa",
    "chunk-kwi",
    "chunk-kwe",
    "chunk-kwo"
  ]),
  cluster("phonological-v-family", "phonological", [
    "chunk-va",
    "chunk-vi",
    "chunk-ve",
    "chunk-vo",
    "chunk-vyu"
  ]),
  ...buildKatakanaSpeedPseudowordConfusionClusters().map((confusionCluster) =>
    cluster("minimal-" + confusionCluster.id, "phonological", [
      ...confusionCluster.itemIds
    ])
  )
];

const clustersByItem = new Map<string, string[]>();

for (const confusionCluster of clusterDefinitions) {
  for (const itemId of confusionCluster.itemIds) {
    clustersByItem.set(itemId, [
      ...(clustersByItem.get(itemId) ?? []),
      confusionCluster.id
    ]);
  }
}

const catalog = Object.freeze(
  itemDefinitions.map((definition) => {
    const confusionClusterIds = clustersByItem.get(definition.id) ?? [];
    const distractorItemIds = buildDistractors(
      definition.id,
      confusionClusterIds
    );

    return Object.freeze({
      ...definition,
      confusionClusterIds: Object.freeze(confusionClusterIds),
      displaySegments: Object.freeze([...definition.displaySegments]),
      distractorItemIds: Object.freeze(distractorItemIds),
      focusChunks: Object.freeze([...definition.focusChunks]),
      tags: Object.freeze([...definition.tags])
    });
  })
);

const catalogById = new Map(
  catalog.map((catalogItem) => [catalogItem.id, catalogItem])
);
const catalogBySurface = new Map(
  catalog.map((catalogItem) => [catalogItem.surface, catalogItem])
);
const confusionClusters = Object.freeze(
  clusterDefinitions.map((confusionCluster) => Object.freeze(confusionCluster))
);
const confusionClustersById = new Map(
  confusionClusters.map((confusionCluster) => [
    confusionCluster.id,
    confusionCluster
  ])
);

export function getKatakanaSpeedCatalog(): readonly KatakanaSpeedItem[] {
  return catalog;
}

export function getKatakanaSpeedConfusionClusters(): readonly KatakanaSpeedConfusionCluster[] {
  return confusionClusters;
}

export function getKatakanaSpeedItemById(
  itemId: string
): KatakanaSpeedItem | undefined {
  return catalogById.get(itemId);
}

export function getKatakanaSpeedItemBySurface(
  surface: string
): KatakanaSpeedItem | undefined {
  return catalogBySurface.get(surface);
}

export function getKatakanaSpeedConfusionClusterById(
  clusterId: string
): KatakanaSpeedConfusionCluster | undefined {
  return confusionClustersById.get(clusterId);
}

function word(
  id: string,
  surface: string,
  tier: Extract<KatakanaSpeedTier, "A" | "B" | "C">,
  focusChunks: readonly string[],
  meaningIt: string
) {
  return item(id, surface, surface, "word-bank", "word", "core", tier, {
    focusChunks,
    meaningIt,
    tags: ["word", `tier-${tier}`],
    targetRtMs: 1450
  });
}

function operationalWordDefinitions() {
  return getKatakanaSpeedOperationalWordSurfaces()
    .filter((surface) => !MANUAL_WORD_SURFACES.has(surface))
    .map((surface) => {
      const focusChunks = inferOperationalFocusChunks(surface);
      const tier = resolveTier(focusChunks);
      const tags = [
        "word",
        "operational-word-bank",
        `tier-${tier}`,
        ...featureTagsForSurface(surface)
      ];

      return item(
        `word-bank-${hashSurface(surface)}`,
        surface,
        surface,
        "loanword-bank",
        "word",
        tier === "C" ? "rare" : tier === "B" ? "edge" : "core",
        tier,
        {
          focusChunks,
          tags,
          targetRtMs: 1450
        }
      );
    });
}

function pseudowordFromCatalog(
  definition: KatakanaSpeedPseudowordCatalogDefinition
) {
  return item(
    definition.id,
    definition.surface,
    definition.surface,
    definition.family,
    "pseudoword",
    definition.rarity,
    definition.tier,
    {
      focusChunks: definition.focusChunks,
      isPseudo: true,
      tags: definition.tags,
      targetRtMs: 1500
    }
  );
}

function sentenceDefinitions() {
  return [
    sentence(
      "P01",
      "ミーティングの前に、ファイルとプレゼンテーションをチェックしてください。",
      ["ティ", "ファ", "チェ"]
    ),
    sentence("P02", "セキュリティのため、パスワードをアップデートしました。", [
      "ティ"
    ]),
    sentence("P03", "ウェブサイトのプロフィールを更新しました。", [
      "ウェ",
      "フィ"
    ]),
    sentence(
      "P04",
      "フィードバックを読んで、ディスカッションにコメントしてください。",
      ["フィ", "ディ"]
    ),
    sentence("P05", "フォルダの中にあるドキュメントをシェアしてください。", [
      "フォ",
      "シェ"
    ]),
    sentence(
      "P06",
      "ソフトウェアのインストールが終わったら、ブラウザを開いてください。",
      ["ウェ"]
    ),
    sentence("P07", "ダッシュボードでステータスとレポートを確認します。", []),
    sentence("P08", "ワークフローのテンプレートをチームでレビューします。", []),
    sentence("P09", "クライアントにデモとチェックリストを送ります。", ["チェ"]),
    sentence("P10", "スマートフォンでスクリーンショットを撮りました。", []),
    sentence("P11", "カフェでコーヒーとチーズケーキを注文しました。", ["フェ"]),
    sentence("P12", "スーパーでサンドイッチとチョコレートを買いました。", []),
    sentence("P13", "ホテルのエレベーターがメンテナンス中です。", []),
    sentence("P14", "タクシーのドライバーにレストランの名前を見せました。", []),
    sentence("P15", "チケットをバッグに入れて、イベント会場へ行きます。", []),
    sentence("P16", "フェスのスケジュールをカレンダーに入れました。", ["フェ"]),
    sentence("P17", "バイオリンとヴァイオリンの表記はどちらも見かけます。", [
      "ヴァ"
    ]),
    sentence("P18", "ウォレットアプリにクレジットカードを登録しました。", [
      "ウォ"
    ]),
    sentence("P19", "ウェディングケーキの写真をシェアしました。", [
      "ウェ",
      "シェ"
    ]),
    sentence("P20", "ウィンドウを閉じてから、ソフトウェアを再起動します。", [
      "ウィ",
      "ウェ"
    ]),
    sentence(
      "P21",
      "プロデューサーがデュエットのレコーディングを始めました。",
      ["デュ"]
    ),
    sentence("P22", "トゥールーズとフィレンツェの写真を見ました。", [
      "トゥ",
      "ツェ",
      "フィ"
    ]),
    sentence("P23", "ヴェネツィアのカフェでエスプレッソを飲みました。", [
      "ヴェ",
      "ツィ"
    ]),
    sentence("P24", "クォーターごとのレポートをマネージャーに送ります。", [
      "クォ"
    ]),
    sentence("P25", "ヒンドゥー教についてのドキュメントを読みました。", [
      "ドゥ"
    ]),
    sentence("P26", "フュージョン料理のレストランを予約しました。", ["フュ"]),
    sentence("P27", "インタビューとインタヴューは表記が違います。", ["ヴュ"]),
    sentence("P28", "レビューとレヴューは意味が同じでも印象が違います。", [
      "ヴュ"
    ]),
    sentence("P29", "ティーとチーを見間違えないようにしてください。", ["ティ"]),
    sentence("P30", "ディーとジーを混ぜると、読み始めで止まります。", ["ディ"]),
    sentence("P31", "ファイルとハイルのような疑似語を高速で区別します。", [
      "ファ"
    ]),
    sentence("P32", "フィルムとヒルムを並べて、反応時間を測ります。", ["フィ"]),
    sentence("P33", "ウェブとエブを並べると、小さいェへの注意が上がります。", [
      "ウェ"
    ]),
    sentence("P34", "ウォークとオークを比べて、ウの有無を確認します。", [
      "ウォ"
    ]),
    sentence("P35", "バッグとバグを比べて、ッを落とさないようにします。", []),
    sentence("P36", "サーバーとサバを比べて、長音を必ず読むようにします。", []),
    sentence(
      "P37",
      "ミーティング、セキュリティ、コミュニティを連続で読みます。",
      ["ティ"]
    ),
    sentence(
      "P38",
      "メディア、ディスプレイ、ディスカッションを連続で読みます。",
      ["ディ"]
    ),
    sentence(
      "P39",
      "ファイル、フィード、フェーズ、フォルダを連続で読みます。",
      ["ファ", "フィ", "フェ", "フォ"]
    ),
    sentence("P40", "ウィンドウ、ウェブ、ウォレットを連続で読みます。", [
      "ウィ",
      "ウェ",
      "ウォ"
    ]),
    sentence(
      "P41",
      "ヴァイオリン、ヴィーナス、ヴェール、ヴォーカルを連続で読みます。",
      ["ヴァ", "ヴィ", "ヴェ", "ヴォ"]
    ),
    sentence("P42", "ツァ、ツェ、ツォを含む名前は、まず小さい母音を見ます。", [
      "ツァ",
      "ツェ",
      "ツォ"
    ]),
    sentence("P43", "カンツォーネとコンツェルンを声に出して読み比べます。", [
      "ツォ",
      "ツェ"
    ]),
    sentence(
      "P44",
      "クァルテット、クィンテット、クォーターは低頻度セットです。",
      ["クァ", "クィ", "クォ"]
    ),
    sentence(
      "P45",
      "テューバとチューブは似ていますが、表記の狙いが違います。",
      ["テュ"]
    ),
    sentence("P46", "フューチャーとヒューマンは最初の音が違います。", ["フュ"]),
    sentence("P47", "デュアル、ドゥーム、ディナーを混ぜて読みます。", [
      "デュ",
      "ドゥ",
      "ディ"
    ]),
    sentence("P48", "トゥルー、ツール、トールを見て、先頭の違いを捉えます。", [
      "トゥ"
    ]),
    sentence(
      "P49",
      "ヴァージョンとバージョンは、文脈によって表記が揺れます。",
      ["ヴァ"]
    ),
    sentence("P50", "ウイスキーとウィスキーは、どちらも見かける表記です。", [
      "ウィ"
    ]),
    sentence(
      "P51",
      "コンピューター、サーバー、マネージャーは語末の長音に注意します。",
      []
    ),
    sentence(
      "P52",
      "チケット、スタッフ、ネットワークは小さいッに注意します。",
      []
    ),
    sentence(
      "P53",
      "アプリ、コンビニ、プレゼンは短縮語として丸ごと覚えます。",
      []
    ),
    sentence(
      "P54",
      "ケース・バイ・ケースの中点は、読む時の区切りを助けます。",
      []
    ),
    sentence(
      "P55",
      "ソフトウェアとハードウェアを交互に読むと、ウェが安定します。",
      ["ウェ"]
    ),
    sentence("P56", "オファー、フォロー、フォーマットを連続で読みます。", [
      "ファ",
      "フォ"
    ]),
    sentence(
      "P57",
      "フィードバック、フィルター、プロフィールを高速で読みます。",
      ["フィ"]
    ),
    sentence("P58", "シェア、ジェンダー、チェンジを一列で読みます。", [
      "シェ",
      "ジェ",
      "チェ"
    ]),
    sentence(
      "P59",
      "ツィ、スィ、ズィは低頻度なので、通常練習では出しすぎません。",
      ["ツィ", "スィ", "ズィ"]
    ),
    sentence(
      "P60",
      "珍しい表記は、正解速度よりも一瞬で固まらないことを重視します。",
      []
    )
  ];
}

function sentence(id: string, surface: string, focusChunks: readonly string[]) {
  const tier = resolveTier(focusChunks);

  return item(
    `sentence-${id}`,
    surface,
    surface,
    "sentence-sprint",
    "sentence",
    "edge",
    tier,
    {
      focusChunks,
      sentenceId: id,
      tags: ["sentence", `tier-${tier}`],
      targetRtMs: 3200
    }
  );
}

function item(
  id: string,
  surface: string,
  reading: string,
  family: string,
  kind: KatakanaSpeedItem["kind"],
  rarity: KatakanaSpeedItem["rarity"],
  tier: KatakanaSpeedTier,
  options: ItemOptions = {}
): CatalogItemDefinition {
  const focusChunks = options.focusChunks ?? defaultFocusChunks(kind, surface);
  const tags = options.tags ?? [kind, `tier-${tier}`];

  return {
    displaySegments: tokenizeKatakanaDisplaySegments(surface),
    family,
    focusChunks,
    id,
    ...(options.isPseudo ? { isPseudo: true } : {}),
    kind,
    ...(options.meaningIt ? { meaningIt: options.meaningIt } : {}),
    moraCount: countKatakanaMora(surface),
    rarity,
    reading,
    ...(options.sentenceId ? { sentenceId: options.sentenceId } : {}),
    surface,
    tags,
    targetRtMs: options.targetRtMs ?? targetRtMsFor(rarity, kind),
    tier
  };
}

function cluster(
  id: string,
  kind: KatakanaSpeedConfusionCluster["kind"],
  itemIds: readonly string[]
): KatakanaSpeedConfusionCluster {
  return {
    id,
    itemIds: Object.freeze([...itemIds]),
    kind
  };
}

function buildDistractors(itemId: string, clusterIds: readonly string[]) {
  const distractors = new Set<string>();
  for (const clusterId of clusterIds) {
    const confusionCluster = clusterDefinitions.find(
      (candidate) => candidate.id === clusterId
    );
    for (const clusterItemId of confusionCluster?.itemIds ?? []) {
      if (clusterItemId !== itemId) {
        distractors.add(clusterItemId);
      }
    }
  }

  const target = itemDefinitions.find((candidate) => candidate.id === itemId);
  for (const candidate of itemDefinitions) {
    if (candidate.id !== itemId && candidate.family === target?.family) {
      distractors.add(candidate.id);
    }
  }

  return [...distractors];
}

function defaultFocusChunks(kind: KatakanaSpeedItem["kind"], surface: string) {
  return kind === "extended_chunk" ? [surface] : [];
}

function inferOperationalFocusChunks(surface: string) {
  return OPERATIONAL_FOCUS_CHUNKS.filter((chunk) => surface.includes(chunk));
}

function featureTagsForSurface(surface: string) {
  const tags: string[] = [];
  if (surface.includes("ー")) {
    tags.push("long-vowel");
  }
  if (surface.includes("ッ")) {
    tags.push("sokuon");
  }
  if (surface.includes("ン")) {
    tags.push("nasal-n");
  }
  if (/[ァィゥェォ]/u.test(surface)) {
    tags.push("small-vowel");
  }
  if (/[ャュョ]/u.test(surface)) {
    tags.push("small-yoon");
  }
  if (/[ガギグゲゴザジズゼゾダヂヅデドバビブベボヴ]/u.test(surface)) {
    tags.push("dakuon");
  }
  if (/[パピプペポ]/u.test(surface)) {
    tags.push("handakuon");
  }
  if (surface.includes("・")) {
    tags.push("middle-dot");
  }

  return tags;
}

function hashSurface(surface: string) {
  let hash = 2166136261;
  for (const char of surface) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function targetRtMsFor(
  rarity: KatakanaSpeedItem["rarity"],
  kind: KatakanaSpeedItem["kind"]
) {
  if (kind === "sentence") {
    return 3200;
  }
  if (kind === "word" || kind === "pseudoword") {
    return 1500;
  }

  return rarity === "rare" ? 1300 : rarity === "edge" ? 1150 : 950;
}

function resolveTier(
  focusChunks: readonly string[]
): Extract<KatakanaSpeedTier, "A" | "B" | "C"> {
  if (focusChunks.some((chunk) => C_TIER_CHUNKS.has(chunk))) {
    return "C";
  }
  if (focusChunks.some((chunk) => B_TIER_CHUNKS.has(chunk))) {
    return "B";
  }

  return "A";
}
