export function buildAskPrompt(input) {
  return [
    "System:\nYou are a precise local coding assistant. Keep answers concise and practical.",
    `User:\n${input.prompt}`,
  ].join("\n\n");
}

export function buildExplainPrompt(input) {
  const question = input.question || "Explain what this code does and mention potential issues.";
  const language = input.language ? `Language: ${input.language}` : "Language: unknown";

  return [
    "System:\nYou explain code clearly and with concrete detail.",
    `User:\n${question}\n\n${language}\n\nCode:\n${input.code}`,
  ].join("\n\n");
}

export function buildSummarizeDiffPrompt(input) {
  const focus = input.focus || "risk";
  return [
    "System:\nSummarize git diffs with actionable findings.",
    `User:\nFocus: ${focus}\n\nDiff:\n${input.diff}`,
  ].join("\n\n");
}

export function buildDraftTestsPrompt(input) {
  const framework = input.framework || "unspecified";
  const target = input.target || "unit";

  return [
    "System:\nGenerate focused test cases from the provided code.",
    `User:\nTarget: ${target}\nFramework: ${framework}\n\nCode:\n${input.code}`,
  ].join("\n\n");
}
