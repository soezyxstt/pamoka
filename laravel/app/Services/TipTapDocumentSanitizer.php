<?php

namespace App\Services;

use InvalidArgumentException;
use JsonException;

final class TipTapDocumentSanitizer
{
    /**
     * @return array{document: array<string, mixed>, imageMediaIds: list<string>}|null
     */
    public function normalize(mixed $value): ?array
    {
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return null;
        }

        if (is_string($value)) {
            try {
                $value = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw new InvalidArgumentException('Format isi berita tidak valid');
            }
        }

        if (! is_array($value) || ($value['type'] ?? null) !== 'doc' || ! is_array($value['content'] ?? null) || ! array_is_list($value['content'])) {
            throw new InvalidArgumentException('Format isi berita tidak valid');
        }

        $imageMediaIds = [];
        $normalizeMarks = function (mixed $value): ?array {
            if ($value === null) {
                return null;
            }
            if (! is_array($value) || ! array_is_list($value)) {
                throw new InvalidArgumentException('Format pemformatan isi berita tidak valid');
            }

            $marks = [];
            foreach ($value as $mark) {
                if (! is_array($mark) || ! is_string($mark['type'] ?? null)) {
                    throw new InvalidArgumentException('Format pemformatan isi berita tidak valid');
                }

                if (in_array($mark['type'], ['bold', 'italic'], true)) {
                    $marks[] = ['type' => $mark['type']];

                    continue;
                }

                if ($mark['type'] === 'link') {
                    $attrs = is_array($mark['attrs'] ?? null) ? $mark['attrs'] : [];
                    $href = is_string($attrs['href'] ?? null) ? trim($attrs['href']) : '';
                    if ($href === '' || (! str_starts_with($href, '/') && ! preg_match('/^https:\/\//i', $href))) {
                        throw new InvalidArgumentException('Tautan isi berita harus menggunakan URL https atau jalur internal');
                    }
                    $marks[] = ['type' => 'link', 'attrs' => ['href' => $href]];

                    continue;
                }

                throw new InvalidArgumentException('Format pemformatan isi berita tidak didukung');
            }

            return $marks;
        };

        $normalizeNode = null;
        $normalizeNode = function (mixed $value) use (&$normalizeNode, &$imageMediaIds, $normalizeMarks): array {
            if (! is_array($value) || ! is_string($value['type'] ?? null) || ! in_array($value['type'], [
                'paragraph',
                'heading',
                'bulletList',
                'orderedList',
                'listItem',
                'blockquote',
                'image',
                'text',
                'hardBreak',
                'horizontalRule',
            ], true)) {
                throw new InvalidArgumentException('Format isi berita tidak didukung');
            }

            if ($value['type'] === 'text') {
                if (! is_string($value['text'] ?? null)) {
                    throw new InvalidArgumentException('Teks isi berita tidak valid');
                }
                $marks = $normalizeMarks($value['marks'] ?? null);
                $node = ['type' => 'text', 'text' => $value['text']];
                if ($marks !== null && count($marks) > 0) {
                    $node['marks'] = $marks;
                }

                return $node;
            }

            if ($value['type'] === 'image') {
                $attrs = is_array($value['attrs'] ?? null) ? $value['attrs'] : [];
                $mediaAssetId = is_string($attrs['mediaAssetId'] ?? null) ? trim($attrs['mediaAssetId']) : '';
                if ($mediaAssetId === '') {
                    throw new InvalidArgumentException('Setiap gambar isi berita harus berasal dari pustaka media');
                }
                $imageMediaIds[$mediaAssetId] = true;
                $node = [
                    'type' => 'image',
                    'attrs' => ['mediaAssetId' => $mediaAssetId],
                ];
                $alt = is_string($attrs['alt'] ?? null) ? $attrs['alt'] : '';
                if ($alt !== '') {
                    $node['attrs']['alt'] = $alt;
                }

                return $node;
            }

            if ($value['type'] === 'heading') {
                $attrs = is_array($value['attrs'] ?? null) ? $value['attrs'] : [];
                $level = $attrs['level'] ?? null;
                if ($level !== 2 && $level !== 3) {
                    throw new InvalidArgumentException('Heading isi berita hanya boleh memakai tingkat 2 atau 3');
                }

                return [
                    'type' => 'heading',
                    'attrs' => ['level' => $level],
                    ...$this->normalizeChildren($value, $normalizeNode),
                ];
            }

            if (in_array($value['type'], ['paragraph'], true)) {
                return [
                    'type' => $value['type'],
                    ...$this->normalizeOptionalChildren($value, $normalizeNode),
                ];
            }

            if (in_array($value['type'], ['hardBreak', 'horizontalRule'], true)) {
                return ['type' => $value['type']];
            }

            return [
                'type' => $value['type'],
                ...$this->normalizeChildren($value, $normalizeNode),
            ];
        };

        $content = array_map($normalizeNode, $value['content']);

        return [
            'document' => ['type' => 'doc', 'content' => $content],
            'imageMediaIds' => array_keys($imageMediaIds),
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, string>  $assetsById
     * @return array<string, mixed>
     */
    public function replaceImageSources(array $document, array $assetsById): array
    {
        $replace = function (mixed $node) use (&$replace, $assetsById): array {
            if (! is_array($node)) {
                return [];
            }

            if (($node['type'] ?? null) === 'image') {
                $attrs = is_array($node['attrs'] ?? null) ? $node['attrs'] : [];
                $mediaAssetId = $attrs['mediaAssetId'] ?? null;
                if (! is_string($mediaAssetId) || ! isset($assetsById[$mediaAssetId])) {
                    throw new InvalidArgumentException('Gambar isi berita tidak ditemukan di pustaka media');
                }
                $node['attrs'] = [...$attrs, 'src' => $assetsById[$mediaAssetId]];

                return $node;
            }

            if (is_array($node['content'] ?? null)) {
                $node['content'] = array_map($replace, $node['content']);
            }

            return $node;
        };

        return $replace($document);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  callable(mixed): array<string, mixed>  $normalizeNode
     * @return array{content: list<array<string, mixed>>}
     */
    private function normalizeChildren(array $node, callable $normalizeNode): array
    {
        if (! is_array($node['content'] ?? null) || ! array_is_list($node['content'])) {
            throw new InvalidArgumentException('Struktur isi berita tidak valid');
        }

        return ['content' => array_map($normalizeNode, $node['content'])];
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  callable(mixed): array<string, mixed>  $normalizeNode
     * @return array{content?: list<array<string, mixed>>}
     */
    private function normalizeOptionalChildren(array $node, callable $normalizeNode): array
    {
        if (! array_key_exists('content', $node)) {
            return [];
        }
        if (! is_array($node['content']) || ! array_is_list($node['content'])) {
            throw new InvalidArgumentException('Struktur isi berita tidak valid');
        }

        return ['content' => array_map($normalizeNode, $node['content'])];
    }
}
