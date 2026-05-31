type KeyboardTargetElement = {
  readonly isContentEditable?: boolean;
  readonly tagName?: string;
  getAttribute?: (name: string) => string | null;
};

export function isEditableKeyboardTarget(target: EventTarget | null) {
  const element = getKeyboardTargetElement(target);

  if (!element) {
    return false;
  }

  return (
    Boolean(element.isContentEditable) ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  );
}

export function isActivationKeyboardTarget(target: EventTarget | null) {
  const element = getKeyboardTargetElement(target);

  if (!element) {
    return false;
  }

  return (
    element.tagName === "BUTTON" ||
    element.tagName === "A" ||
    element.getAttribute?.("role") === "button"
  );
}

function getKeyboardTargetElement(
  target: EventTarget | null
): KeyboardTargetElement | null {
  if (!target) {
    return null;
  }

  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    return target;
  }

  if (typeof target !== "object" || !("tagName" in target)) {
    return null;
  }

  const tagName = (target as { tagName?: unknown }).tagName;

  if (typeof tagName !== "string") {
    return null;
  }

  return {
    ...(target as KeyboardTargetElement),
    tagName: tagName.toUpperCase()
  };
}
