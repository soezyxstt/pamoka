import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompleteGalleryItemOrder,
  normalizeYoutubeId,
} from "../gallery-validation";

test("normalizeYoutubeId menerima ID dan tautan YouTube", () => {
  assert.equal(normalizeYoutubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    normalizeYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(normalizeYoutubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(normalizeYoutubeId(""), null);
  assert.throws(() => normalizeYoutubeId("bukan id"), /tidak valid/);
});

test("assertCompleteGalleryItemOrder menolak daftar parsial, asing, dan duplikat", () => {
  assert.doesNotThrow(() => assertCompleteGalleryItemOrder(["b", "a"], ["a", "b"]));
  assert.throws(() => assertCompleteGalleryItemOrder(["a"], ["a", "b"]), /tidak lengkap/);
  assert.throws(
    () => assertCompleteGalleryItemOrder(["a", "asing"], ["a", "b"]),
    /tidak lengkap/,
  );
  assert.throws(
    () => assertCompleteGalleryItemOrder(["a", "b", "a"], ["a", "b"]),
    /tidak lengkap/,
  );
});
