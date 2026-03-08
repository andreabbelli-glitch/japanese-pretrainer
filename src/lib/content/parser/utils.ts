import type {
  IssueCategory,
  SourceLocation,
  SourcePoint,
  SourceRange,
  ValidationIssue
} from "../types";

export function createIssue(input: {
  code: string;
  category: IssueCategory;
  message: string;
  filePath: string;
  path?: string;
  hint?: string;
  details?: Record<string, string | number | boolean | null>;
  range?: SourceRange;
}): ValidationIssue {
  const location: SourceLocation = {
    filePath: input.filePath
  };

  if (input.range) {
    location.range = input.range;
  }

  return {
    code: input.code,
    category: input.category,
    message: input.message,
    location,
    path: input.path,
    hint: input.hint,
    details: input.details
  };
}

export function shiftPoint(point: SourcePoint, lineOffset: number): SourcePoint {
  return {
    ...point,
    line: point.line + lineOffset
  };
}

export function shiftRange(
  range: SourceRange | undefined,
  lineOffset: number
): SourceRange | undefined {
  if (!range) {
    return undefined;
  }

  return {
    start: shiftPoint(range.start, lineOffset),
    end: shiftPoint(range.end, lineOffset)
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isUrlSafeSlug(value: string): boolean {
  return value.length > 0 && !value.includes("/") && encodeURIComponent(value) === value;
}
