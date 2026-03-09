export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeGrammarSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[~〜～]/g, "");
}

const kanaDigraphRomajiMap: Record<string, string> = {
  "うぃ": "wi",
  "うぇ": "we",
  "うぉ": "wo",
  "きゃ": "kya",
  "きゅ": "kyu",
  "きょ": "kyo",
  "ぎゃ": "gya",
  "ぎゅ": "gyu",
  "ぎょ": "gyo",
  "しゃ": "sha",
  "しゅ": "shu",
  "しょ": "sho",
  "じゃ": "ja",
  "じゅ": "ju",
  "じょ": "jo",
  "しぇ": "she",
  "じぇ": "je",
  "ちゃ": "cha",
  "ちゅ": "chu",
  "ちょ": "cho",
  "ちぇ": "che",
  "てぃ": "ti",
  "でぃ": "di",
  "とぅ": "tu",
  "どぅ": "du",
  "にゃ": "nya",
  "にゅ": "nyu",
  "にょ": "nyo",
  "ひゃ": "hya",
  "ひゅ": "hyu",
  "ひょ": "hyo",
  "びゃ": "bya",
  "びゅ": "byu",
  "びょ": "byo",
  "ぴゃ": "pya",
  "ぴゅ": "pyu",
  "ぴょ": "pyo",
  "ふぁ": "fa",
  "ふぃ": "fi",
  "ふぇ": "fe",
  "ふぉ": "fo",
  "ふゅ": "fyu",
  "みゃ": "mya",
  "みゅ": "myu",
  "みょ": "myo",
  "りゃ": "rya",
  "りゅ": "ryu",
  "りょ": "ryo",
  "ゔぁ": "va",
  "ゔぃ": "vi",
  "ゔぇ": "ve",
  "ゔぉ": "vo",
  "ゔゅ": "vyu"
};

const kanaRomajiMap: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "wi",
  ゑ: "we",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ゎ: "wa",
  ゔ: "vu"
};

export function foldJapaneseKana(value: string): string {
  return [...value.normalize("NFKC")]
    .map((char) => {
      const codePoint = char.codePointAt(0);

      if (!codePoint) {
        return char;
      }

      if (codePoint >= 0x30a1 && codePoint <= 0x30f6) {
        return String.fromCodePoint(codePoint - 0x60);
      }

      return char;
    })
    .join("");
}

export function compactLatinSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");
}

export function romanizeKanaForSearch(value: string): string {
  const normalized = foldJapaneseKana(normalizeSearchText(value));
  const chars = [...normalized];
  let output = "";

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];

    if (!current) {
      continue;
    }

    if (current === "っ") {
      const nextChunk = lookupKanaRomaji(chars, index + 1);
      const doubledConsonant = nextChunk?.match(/^[bcdfghjklmnpqrstvwxyz]/)?.[0];

      if (doubledConsonant) {
        output += doubledConsonant;
      }

      continue;
    }

    if (current === "ー") {
      const trailingVowel = findTrailingVowel(output);

      if (trailingVowel) {
        output += trailingVowel;
      }

      continue;
    }

    const digraph = kanaDigraphRomajiMap[`${current}${chars[index + 1] ?? ""}`];

    if (digraph) {
      output += digraph;
      index += 1;
      continue;
    }

    const single = kanaRomajiMap[current];

    if (single) {
      output += single;
      continue;
    }

    if (/^[a-z0-9 ]$/i.test(current)) {
      output += current;
    }
  }

  return compactLatinSearchText(output);
}

function lookupKanaRomaji(chars: string[], index: number) {
  const current = chars[index];

  if (!current) {
    return null;
  }

  return (
    kanaDigraphRomajiMap[`${current}${chars[index + 1] ?? ""}`] ??
    kanaRomajiMap[current] ??
    null
  );
}

function findTrailingVowel(value: string) {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];

    if (char && /[aeiou]/.test(char)) {
      return char;
    }
  }

  return "";
}
