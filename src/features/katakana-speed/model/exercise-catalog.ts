export type KatakanaSpeedExerciseDefinition = {
  readonly defaultNoRomaji: boolean;
  readonly id: string;
  readonly interaction:
    | "choice"
    | "raw_choice"
    | "self_check"
    | "segment_select"
    | "tile_builder"
    | "aggregate";
  readonly label: string;
  readonly requiresAudio: boolean;
  readonly supported: boolean;
};

export type KatakanaSpeedMoraTrapFeature =
  | "long-vowel"
  | "sokuon"
  | "small-vowel"
  | "small-yoon"
  | "nasal-n"
  | "dakuon"
  | "handakuon";

export type KatakanaSpeedMoraTrapPair = {
  readonly correctSurface: string;
  readonly feature: KatakanaSpeedMoraTrapFeature;
  readonly focusChunks: readonly string[];
  readonly id: string;
  readonly trapSurface: string;
};

export type KatakanaSpeedVariantPair = {
  readonly firstSurface: string;
  readonly focusChunks: readonly string[];
  readonly id: string;
  readonly secondSurface: string;
};

export type KatakanaSpeedChunkSpottingTarget = {
  readonly chunk: string;
  readonly id: string;
  readonly wordSurface: string;
};

export type KatakanaSpeedLadderDefinition = {
  readonly id: string;
  readonly rows: readonly string[];
  readonly targetSurface: string;
};

const RAW_OPTION_PREFIX = "raw:";

const EXERCISE_CATALOG: readonly KatakanaSpeedExerciseDefinition[] =
  Object.freeze([
    exercise("E01", "Diagnostic Fluency Probe", "choice"),
    exercise("E02", "Blink Recognition", "choice"),
    exercise("E03", "Visual Minimal Pair", "choice"),
    exercise("E04", "Four-Choice Confusion Set", "choice"),
    exercise("E05", "Same/Different Flash", "raw_choice"),
    exercise("E06", "Audio Match", "choice", {
      requiresAudio: true,
      supported: false
    }),
    exercise("E07", "Kana Dictation Builder", "tile_builder", {
      requiresAudio: true,
      supported: false
    }),
    exercise("E08", "Scrambled Loanword Builder", "tile_builder"),
    exercise("E09", "Chunk Spotting", "segment_select"),
    exercise("E10", "Timed Word Naming", "self_check"),
    exercise("E11", "Loanword Decoder", "self_check"),
    exercise("E12", "Pseudoword Read Sprint", "self_check"),
    exercise("E13", "RAN Grid", "aggregate"),
    exercise("E14", "Vertical Confusion Ladder", "raw_choice"),
    exercise("E15", "Mora Trap Hunt", "raw_choice"),
    exercise("E16", "Long/Sokuon Pair Race", "raw_choice"),
    exercise("E17", "Variant Normalization", "raw_choice"),
    exercise("E18", "Sentence Sprint / Repeated Reading", "self_check"),
    exercise("E19", "Audio Shadowing Micro", "self_check", {
      requiresAudio: true,
      supported: false
    }),
    exercise("E20", "Error Repair Drill", "choice"),
    exercise("E21", "Adaptive Mixed Blitz", "choice"),
    exercise("E22", "Hard Mode No-Romaji", "choice", {
      defaultNoRomaji: true
    })
  ]);

const OPERATIONAL_WORD_BANK = splitOperationalWords(`
メール、メッセージ、チャット、チャンネル、ウェブ、ウェブサイト、ソフトウェア、ハードウェア、アプリ、アプリケーション
データ、データベース、サーバー、クラウド、ブラウザ、フォルダ、ファイル、フォーマット、フォーム、プラットフォーム
アップデート、ダウンロード、インストール、ログイン、ログアウト、パスワード、セキュリティ、プライバシー、ネットワーク、インターネット
オンライン、オフライン、コンピューター、タブレット、スマートフォン、ディスプレイ、モニター、キーボード、スクリーンショット、プロフィール
フィード、フィードバック、ミーティング、プレゼン、プレゼンテーション、プロジェクト、マネージャー、チーム、メンバー、カレンダー
スケジュール、ドキュメント、テンプレート、ダッシュボード、レポート、デモ、テスト、チェック、チェックリスト、タスク
ステータス、コメント、フォロー、シェア、リンク、ディスカッション、コミュニティ、メディア、マーケティング、ブランディング
リクルーター、エンジニア、デザイナー、プロダクト、カスタマー、クライアント、セールス、サポート、トレーニング、ラーニング
キャリア、オファー、オフィス、フィルター、アカウント、ユーザー、ゲスト、ゲートウェイ、ワークフロー、ロードマップ
コンビニ、スーパー、レストラン、カフェ、メニュー、コーヒー、ミルク、バター、チーズ、ケーキ
チョコレート、アイスクリーム、パン、サンドイッチ、ハンバーガー、ピザ、パスタ、サラダ、スープ、ソース
カレー、バス、タクシー、ホテル、エレベーター、エスカレーター、トイレ、ドア、エアコン、テレビ
ラジオ、カメラ、ビデオ、ニュース、スポーツ、サッカー、テニス、バスケットボール、ギター、ピアノ
バイオリン、ヴァイオリン、コンサート、チケット、プレゼント、パーティー、イベント、フェス、クリスマス、ハロウィン
バレンタイン、デート、ベッド、ソファ、テーブル、カーテン、シャワー、タオル、シャンプー、スーツ
シャツ、ジャケット、コート、セーター、スカート、ズボン、サンダル、スニーカー、バッグ、キャッシュカード
クレジットカード、レシート、サービス、センター、キャンペーン、セール、ポイント、クーポン、レンタル、ルール
アメリカ、イギリス、イタリア、フランス、ドイツ、スペイン、ポルトガル、オランダ、スウェーデン、ノルウェー
フィンランド、デンマーク、アイスランド、アイルランド、オーストリア、スイス、ベルギー、ポーランド、ウクライナ、ロシア
トルコ、ギリシャ、エジプト、イスラエル、イェルサレム、インド、インドネシア、フィリピン、シンガポール、タイ
ベトナム、オーストラリア、カナダ、ブラジル、アルゼンチン、メキシコ、グアテマラ、グァテマラ、パラグアイ、パラグァイ
カリフォルニア、ニューヨーク、ワシントン、ロサンゼルス、シカゴ、ミルウォーキー、フィレンツェ、ヴェネツィア、ローマ、ミラノ
トリノ、ナポリ、シチリア、ヴェルサイユ、ウィーン、ウォルポール、マンチェスター、シェフィールド、バッファロー、ノルマンディー
シェーカー、シェード、ジェットエンジン、ダイジェスト、チェーン、チェス、ピッツァ、モーツァルト、ツェッペリン、コンツェルン
カンツォーネ、メッツォ、ティーパーティー、ボランティア、ディーゼルエンジン、ビルディング、ディズニー、フェンシング、フォークダンス、プロデューサー
デュエット、デュアル、デューティー、ウィスキー、ウィンドウ、ウェディング、ストップウォッチ、クァルテット、クィンテット、クェスチョンマーク
クォーター、クォーク、クォーツ、ティツィアーノ、ソルジェニーツィン、トゥールーズ、ヒンドゥー、ドゥーム、ドゥカティ、ヴァイオリン
ヴィーナス、ヴィクトリア、ヴィジュアル、ヴェール、ヴォーカル、ヴォルテール、テューバ、テュニジア、フュージョン、フューチャー
インタヴュー、レヴュー、ヴュイヤール、キェルケゴール、ケース・バイ・ケース、コーヒータイム、ショーテーブル、サラダボウル、タキシード、レイアウト
`);

const MORA_TRAP_PAIRS: readonly KatakanaSpeedMoraTrapPair[] = Object.freeze([
  trap("trap-bag-bug", "バッグ", "バグ", "sokuon"),
  trap("trap-bed-bedo", "ベッド", "ベド", "sokuon"),
  trap("trap-net-neto", "ネット", "ネト", "sokuon"),
  trap("trap-ticket", "チケット", "チケト", "sokuon"),
  trap("trap-coffee", "コーヒー", "コヒー", "long-vowel"),
  trap("trap-server", "サーバー", "サバ", "long-vowel"),
  trap("trap-super", "スーパー", "スパ", "long-vowel"),
  trap("trap-ti-tei", "ティ", "テイ", "small-vowel", ["ティ"]),
  trap("trap-fi-fui", "フィ", "フイ", "small-vowel", ["フィ"]),
  trap("trap-we-ue", "ウェ", "ウエ", "small-vowel", ["ウェ"]),
  trap("trap-wo-uo", "ウォ", "ウオ", "small-vowel", ["ウォ"]),
  trap("trap-kyu-kiyu", "キュ", "キユ", "small-yoon", ["キュ"]),
  trap("trap-dyu-deyu", "デュ", "デユ", "small-yoon", ["デュ"])
]);

const VARIANT_PAIRS: readonly KatakanaSpeedVariantPair[] = Object.freeze([
  variant("variant-whisky", "ウイスキー", "ウィスキー", ["ウィ"]),
  variant("variant-wedding", "ウエディング", "ウェディング", ["ウェ"]),
  variant("variant-violin", "バイオリン", "ヴァイオリン", ["ヴァ"]),
  variant("variant-interview", "インタビュー", "インタヴュー", ["ヴュ"]),
  variant("variant-review", "レビュー", "レヴュー", ["ヴュ"]),
  variant("variant-guatemala", "グアテマラ", "グァテマラ", ["グァ"]),
  variant("variant-paraguay", "パラグアイ", "パラグァイ", ["グァ"])
]);

const CHUNK_SPOTTING_TARGETS: readonly KatakanaSpeedChunkSpottingTarget[] =
  Object.freeze([
    spotting("spot-security-ti", "セキュリティ", "ティ"),
    spotting("spot-meeting-ti", "ミーティング", "ティ"),
    spotting("spot-media-di", "メディア", "ディ"),
    spotting("spot-discussion-di", "ディスカッション", "ディ"),
    spotting("spot-feedback-fi", "フィードバック", "フィ"),
    spotting("spot-profile-fi", "プロフィール", "フィ"),
    spotting("spot-website-we", "ウェブサイト", "ウェ"),
    spotting("spot-wallet-wo", "ウォレット", "ウォ"),
    spotting("spot-producer-dyu", "プロデューサー", "デュ"),
    spotting("spot-fusion-fyu", "フュージョン", "フュ")
  ]);

const LADDER_DEFINITIONS: readonly KatakanaSpeedLadderDefinition[] =
  Object.freeze([
    ladder("ladder-di", "ディ", ["ディ", "ジ", "デイ", "ドゥ", "ティ", "デュ"]),
    ladder("ladder-ti", "ティ", ["ティ", "チ", "テイ", "ディ", "テ", "テュ"]),
    ladder("ladder-f-family", "フィ", [
      "ファ",
      "ハ",
      "フィ",
      "ヒ",
      "フェ",
      "ヘ",
      "フォ",
      "ホ",
      "フュ",
      "ヒュ"
    ]),
    ladder("ladder-w-family", "ウェ", [
      "ウィ",
      "イ",
      "ウェ",
      "エ",
      "ウォ",
      "オ",
      "ウエ",
      "ウオ"
    ]),
    ladder("ladder-v-family", "ヴァ", [
      "ヴァ",
      "バ",
      "ヴィ",
      "ビ",
      "ヴェ",
      "ベ",
      "ヴォ",
      "ボ"
    ])
  ]);

export function getKatakanaSpeedExerciseCatalog(): readonly KatakanaSpeedExerciseDefinition[] {
  return EXERCISE_CATALOG;
}

export function getKatakanaSpeedOperationalWordSurfaces(): readonly string[] {
  return OPERATIONAL_WORD_BANK;
}

export function getKatakanaSpeedMoraTrapPairs(): readonly KatakanaSpeedMoraTrapPair[] {
  return MORA_TRAP_PAIRS;
}

export function getKatakanaSpeedVariantPairs(): readonly KatakanaSpeedVariantPair[] {
  return VARIANT_PAIRS;
}

export function getKatakanaSpeedChunkSpottingTargets(): readonly KatakanaSpeedChunkSpottingTarget[] {
  return CHUNK_SPOTTING_TARGETS;
}

export function getKatakanaSpeedLadderDefinitions(): readonly KatakanaSpeedLadderDefinition[] {
  return LADDER_DEFINITIONS;
}

export function encodeKatakanaSpeedRawOption(surface: string): string {
  return `${RAW_OPTION_PREFIX}${encodeURIComponent(surface)}`;
}

export function decodeKatakanaSpeedRawOption(value: string): string {
  if (!value.startsWith(RAW_OPTION_PREFIX)) {
    return value;
  }

  const encoded = value.slice(RAW_OPTION_PREFIX.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function isKatakanaSpeedRawOption(value: string): boolean {
  return value.startsWith(RAW_OPTION_PREFIX);
}

function exercise(
  id: string,
  label: string,
  interaction: KatakanaSpeedExerciseDefinition["interaction"],
  options: Partial<
    Pick<
      KatakanaSpeedExerciseDefinition,
      "defaultNoRomaji" | "requiresAudio" | "supported"
    >
  > = {}
): KatakanaSpeedExerciseDefinition {
  return Object.freeze({
    defaultNoRomaji: options.defaultNoRomaji ?? true,
    id,
    interaction,
    label,
    requiresAudio: options.requiresAudio ?? false,
    supported: options.supported ?? true
  });
}

function splitOperationalWords(value: string) {
  return Object.freeze([
    ...new Set(
      value
        .split(/[\s、,]+/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  ]);
}

function trap(
  id: string,
  correctSurface: string,
  trapSurface: string,
  feature: KatakanaSpeedMoraTrapFeature,
  focusChunks: readonly string[] = []
): KatakanaSpeedMoraTrapPair {
  return Object.freeze({
    correctSurface,
    feature,
    focusChunks,
    id,
    trapSurface
  });
}

function variant(
  id: string,
  firstSurface: string,
  secondSurface: string,
  focusChunks: readonly string[]
): KatakanaSpeedVariantPair {
  return Object.freeze({
    firstSurface,
    focusChunks,
    id,
    secondSurface
  });
}

function spotting(
  id: string,
  wordSurface: string,
  chunk: string
): KatakanaSpeedChunkSpottingTarget {
  return Object.freeze({
    chunk,
    id,
    wordSurface
  });
}

function ladder(
  id: string,
  targetSurface: string,
  rows: readonly string[]
): KatakanaSpeedLadderDefinition {
  return Object.freeze({
    id,
    rows,
    targetSurface
  });
}
