/**
 * 与 Rails `MediaLibrary::Markdown.normalize_for_fingerprint` 对齐，供 `c456 asset fingerprint` 使用。
 * @param {string} markdown
 * @returns {string}
 */
export function normalizeForFingerprint(markdown) {
  const OMIT = "__C456_ASSET_URL_OMITTED__";
  const dquote =
    /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s+"(c456:asset\/(\d+))"\s*\)/g;
  const squote =
    /!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)\s+'(c456:asset\/(\d+))'\s*\)/g;
  let s = String(markdown ?? "");
  s = s.replace(dquote, (_m, alt, _url, title) => `![${alt}](${OMIT} "${title}")`);
  s = s.replace(squote, (_m, alt, _url, title) => `![${alt}](${OMIT} '${title}')`);
  return s;
}
