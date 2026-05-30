export function isAiFallback(source?: string | null) {
  return Boolean(source?.startsWith("fallback"));
}

export function formatAiSource(source?: string | null) {
  if (!source) return "AI";
  if (source === "gemini") return "Gemini";
  if (source === "fallback") return "Local fallback";
  if (source === "fallback_after_error") return "Fallback after provider error";

  if (source.startsWith("project_")) {
    const [, rawProvider, rawName] =
      source.match(/^project_([^:]+):(.+)$/) || [];
    const provider = rawProvider
      ? rawProvider.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "Project AI";
    return rawName ? `${rawName} (${provider})` : provider;
  }

  return source.replaceAll("_", " ");
}
