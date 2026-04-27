export type KatakanaSpeedExerciseDefinition = {
  readonly defaultNoRomaji: boolean;
  readonly id: string;
  readonly interaction: "choice" | "raw_choice" | "self_check" | "aggregate";
  readonly label: string;
  readonly requiresAudio: boolean;
  readonly supported: boolean;
};

const RAW_OPTION_PREFIX = "raw:";

const EXERCISE_CATALOG: readonly KatakanaSpeedExerciseDefinition[] =
  Object.freeze([
    exercise("E01", "Diagnostic Fluency Probe", "choice"),
    exercise("E02", "Blink Recognition", "choice"),
    exercise("E03", "Visual Minimal Pair", "choice"),
    exercise("E04", "Four-Choice Confusion Set", "choice"),
    exercise("E10", "Timed Word Naming", "self_check"),
    exercise("E12", "Pseudoword Read Sprint", "self_check"),
    exercise("E13", "RAN Grid", "aggregate"),
    exercise("E15", "Mora Contrast", "raw_choice"),
    exercise("E16", "Long/Sokuon Contrast", "raw_choice"),
    exercise("E18", "Sentence Sprint / Repeated Reading", "self_check"),
    exercise("E20", "Error Repair Drill", "choice")
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

export function getKatakanaSpeedExerciseCatalog(): readonly KatakanaSpeedExerciseDefinition[] {
  return EXERCISE_CATALOG;
}

export function getKatakanaSpeedOperationalWordSurfaces(): readonly string[] {
  return OPERATIONAL_WORD_BANK;
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
