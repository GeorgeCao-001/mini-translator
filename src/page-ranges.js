"use strict";

// PDF physical page numbers, never printed page labels. No network or host APIs.
function rangeError(code, details = {}) {
  const error = new RangeError(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function formatPageRanges(pages) {
  const nums = [...new Set(pages)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < nums.length; i++) {
    const first = nums[i];
    let last = first;
    while (nums[i + 1] === last + 1) last = nums[++i];
    parts.push(first === last ? String(first) : `${first}-${last}`);
  }
  return parts.join(", ");
}

function parsePageRange(value, totalPages) {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1)
    throw rangeError("total");
  const text = String(value ?? "").trim().replace(/[，、]/g, ",").replace(/[–—−]/g, "-");
  if (!text) {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return { pages, label: formatPageRanges(pages), all: true };
  }
  const intervals = [];
  for (const part of text.split(",")) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) throw rangeError("syntax");
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1)
      throw rangeError("syntax");
    if (start > end) throw rangeError("reversed");
    if (end > totalPages) throw rangeError("bounds", { total: totalPages });
    intervals.push([start, end]);
  }
  const set = new Set();
  for (const [first, last] of intervals) for (let p = first; p <= last; p++) set.add(p);
  const pages = [...set].sort((a, b) => a - b);
  return { pages, label: formatPageRanges(pages), all: pages.length === totalPages };
}

function pageRangeErrorMessage(error, t) {
  const key = ["total", "syntax", "reversed", "bounds"].includes(error?.code)
    ? error.code : "syntax";
  return t(`pages.error_${key}`, { total: error?.total });
}

function normalizePageNumbers(value, totalPages) {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1) throw rangeError("total");
  if (value == null) return parsePageRange("", totalPages).pages;
  if (!Array.isArray(value) || !value.length) throw rangeError("syntax");
  if (value.some(p => !Number.isSafeInteger(p) || p < 1 || p > totalPages))
    throw rangeError("bounds", { total: totalPages });
  return [...new Set(value)].sort((a, b) => a - b);
}

function validateBlockPages(blocks, pages) {
  const set = new Set(pages);
  return blocks.every(b => {
    const last = b.continuedThroughPage ?? b.page;
    if (!Number.isSafeInteger(b.page) || !Number.isSafeInteger(last) || last < b.page) return false;
    for (let p = b.page; p <= last; p++) if (!set.has(p)) return false;
    return true;
  });
}

module.exports = { parsePageRange, formatPageRanges, pageRangeErrorMessage, normalizePageNumbers, validateBlockPages };
