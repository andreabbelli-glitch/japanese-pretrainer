import type { KatakanaSpeedItem } from "../types";

const KATAKANA_READING_PATTERN = /^[\u30a0-\u30ff\s・]+$/u;
const LATIN_PATTERN = /[a-z]/iu;

const KATAKANA_DIGRAPH_ROMAJI: ReadonlyMap<string, string> = new Map([
  ["イェ", "ye"],
  ["ウィ", "wi"],
  ["ウェ", "we"],
  ["ウォ", "wo"],
  ["キャ", "kya"],
  ["キュ", "kyu"],
  ["キョ", "kyo"],
  ["キェ", "kye"],
  ["ギャ", "gya"],
  ["ギュ", "gyu"],
  ["ギョ", "gyo"],
  ["ギェ", "gye"],
  ["クァ", "kwa"],
  ["クィ", "kwi"],
  ["クェ", "kwe"],
  ["クォ", "kwo"],
  ["グァ", "gwa"],
  ["グィ", "gwi"],
  ["グェ", "gwe"],
  ["グォ", "gwo"],
  ["シャ", "sha"],
  ["シュ", "shu"],
  ["ショ", "sho"],
  ["シェ", "she"],
  ["ジャ", "ja"],
  ["ジュ", "ju"],
  ["ジョ", "jo"],
  ["ジェ", "je"],
  ["スィ", "si"],
  ["ズィ", "zi"],
  ["チャ", "cha"],
  ["チュ", "chu"],
  ["チョ", "cho"],
  ["チェ", "che"],
  ["ツァ", "tsa"],
  ["ツィ", "tsi"],
  ["ツェ", "tse"],
  ["ツォ", "tso"],
  ["ティ", "ti"],
  ["テュ", "tyu"],
  ["ディ", "di"],
  ["デュ", "dyu"],
  ["トゥ", "tu"],
  ["ドゥ", "du"],
  ["ニャ", "nya"],
  ["ニュ", "nyu"],
  ["ニョ", "nyo"],
  ["ニェ", "nye"],
  ["ヒャ", "hya"],
  ["ヒュ", "hyu"],
  ["ヒョ", "hyo"],
  ["ヒェ", "hye"],
  ["ビャ", "bya"],
  ["ビュ", "byu"],
  ["ビョ", "byo"],
  ["ビェ", "bye"],
  ["ピャ", "pya"],
  ["ピュ", "pyu"],
  ["ピョ", "pyo"],
  ["ピェ", "pye"],
  ["ファ", "fa"],
  ["フィ", "fi"],
  ["フェ", "fe"],
  ["フォ", "fo"],
  ["フュ", "fyu"],
  ["フョ", "fyo"],
  ["ミャ", "mya"],
  ["ミュ", "myu"],
  ["ミョ", "myo"],
  ["リャ", "rya"],
  ["リュ", "ryu"],
  ["リョ", "ryo"],
  ["ヴァ", "va"],
  ["ヴィ", "vi"],
  ["ヴェ", "ve"],
  ["ヴォ", "vo"],
  ["ヴャ", "vya"],
  ["ヴュ", "vyu"],
  ["ヴョ", "vyo"]
]);

const KATAKANA_ROMAJI: ReadonlyMap<string, string> = new Map([
  ["ア", "a"],
  ["イ", "i"],
  ["ウ", "u"],
  ["エ", "e"],
  ["オ", "o"],
  ["カ", "ka"],
  ["キ", "ki"],
  ["ク", "ku"],
  ["ケ", "ke"],
  ["コ", "ko"],
  ["サ", "sa"],
  ["シ", "shi"],
  ["ス", "su"],
  ["セ", "se"],
  ["ソ", "so"],
  ["タ", "ta"],
  ["チ", "chi"],
  ["ツ", "tsu"],
  ["テ", "te"],
  ["ト", "to"],
  ["ナ", "na"],
  ["ニ", "ni"],
  ["ヌ", "nu"],
  ["ネ", "ne"],
  ["ノ", "no"],
  ["ハ", "ha"],
  ["ヒ", "hi"],
  ["フ", "fu"],
  ["ヘ", "he"],
  ["ホ", "ho"],
  ["マ", "ma"],
  ["ミ", "mi"],
  ["ム", "mu"],
  ["メ", "me"],
  ["モ", "mo"],
  ["ヤ", "ya"],
  ["ユ", "yu"],
  ["ヨ", "yo"],
  ["ラ", "ra"],
  ["リ", "ri"],
  ["ル", "ru"],
  ["レ", "re"],
  ["ロ", "ro"],
  ["ワ", "wa"],
  ["ヰ", "wi"],
  ["ヱ", "we"],
  ["ヲ", "wo"],
  ["ン", "n"],
  ["ガ", "ga"],
  ["ギ", "gi"],
  ["グ", "gu"],
  ["ゲ", "ge"],
  ["ゴ", "go"],
  ["ザ", "za"],
  ["ジ", "ji"],
  ["ズ", "zu"],
  ["ゼ", "ze"],
  ["ゾ", "zo"],
  ["ダ", "da"],
  ["ヂ", "ji"],
  ["ヅ", "zu"],
  ["デ", "de"],
  ["ド", "do"],
  ["バ", "ba"],
  ["ビ", "bi"],
  ["ブ", "bu"],
  ["ベ", "be"],
  ["ボ", "bo"],
  ["パ", "pa"],
  ["ピ", "pi"],
  ["プ", "pu"],
  ["ペ", "pe"],
  ["ポ", "po"],
  ["ヴ", "vu"],
  ["ァ", "a"],
  ["ィ", "i"],
  ["ゥ", "u"],
  ["ェ", "e"],
  ["ォ", "o"],
  ["ャ", "ya"],
  ["ュ", "yu"],
  ["ョ", "yo"],
  ["ヮ", "wa"]
]);

export function formatKatakanaSpeedReading(
  input: KatakanaSpeedItem | string | null | undefined
) {
  if (!input) {
    return null;
  }

  const surface = typeof input === "string" ? input : input.surface;
  const explicitReading = typeof input === "string" ? "" : input.reading;

  if (explicitReading && explicitReading !== surface) {
    return explicitReading;
  }

  const reading = romanizeKatakanaForLearner(surface);

  return reading && LATIN_PATTERN.test(reading) ? reading : null;
}

export function romanizeKatakanaForLearner(input: string) {
  const normalized = input.normalize("NFKC").trim();

  if (!normalized || !KATAKANA_READING_PATTERN.test(normalized)) {
    return null;
  }

  const chars = [...normalized];
  const output: string[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];

    if (!current) {
      continue;
    }

    if (current === " " || current === "・") {
      appendSeparator(output);
      continue;
    }

    if (current === "ッ") {
      const nextChunk = lookupKatakanaChunk(chars, index + 1);
      const doubledConsonant = nextChunk?.match(
        /^[bcdfghjklmnpqrstvwxyz]/
      )?.[0];

      if (doubledConsonant) {
        output.push(doubledConsonant);
      }

      continue;
    }

    if (current === "ー") {
      const trailingVowel = findTrailingVowel(output.join(""));

      if (trailingVowel) {
        output.push(trailingVowel);
      }

      continue;
    }

    const digraph = KATAKANA_DIGRAPH_ROMAJI.get(
      `${current}${chars[index + 1] ?? ""}`
    );

    if (digraph) {
      output.push(digraph);
      index += 1;
      continue;
    }

    const single = KATAKANA_ROMAJI.get(current);

    if (single) {
      output.push(single);
    }
  }

  return output.join("").replace(/\s+/g, " ").trim() || null;
}

function lookupKatakanaChunk(chars: readonly string[], index: number) {
  const current = chars[index];

  if (!current) {
    return null;
  }

  return (
    KATAKANA_DIGRAPH_ROMAJI.get(`${current}${chars[index + 1] ?? ""}`) ??
    KATAKANA_ROMAJI.get(current) ??
    null
  );
}

function appendSeparator(output: string[]) {
  if (output.length > 0 && output[output.length - 1] !== " ") {
    output.push(" ");
  }
}

function findTrailingVowel(value: string) {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];

    if (char && /[aeiou]/i.test(char)) {
      return char;
    }
  }

  return "";
}
