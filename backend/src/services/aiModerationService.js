const timeoutMs = Number(process.env.AI_MODERATION_TIMEOUT_MS) || 2500;

/**
 * Optional AI moderation adapter.
 * Expected POST {AI_MODERATION_URL}/moderate with { text, content_type }.
 * Expected JSON: { flagged: boolean, category?: string, confidence?: number }.
 */
async function moderateText(text, contentType = "message") {
  const baseUrl = process.env.AI_MODERATION_URL;
  if (!baseUrl) return { status: "unavailable", category: "", confidence: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content_type: contentType }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "unavailable", category: "", confidence: null };
    }

    const result = await response.json();
    const confidence = Number(result.confidence);
    return {
      status: result.flagged === true ? "flagged" : "clear",
      category: typeof result.category === "string" ? result.category.slice(0, 100) : "",
      confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : null,
    };
  } catch (_) {
    // Fail safe: no auto-delete or auto-approval if AI is unavailable.
    return { status: "unavailable", category: "", confidence: null };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { moderateText };
