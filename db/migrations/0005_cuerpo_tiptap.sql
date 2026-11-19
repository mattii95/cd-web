-- Convierte post.body del formato de bloques (array) al doc de Tiptap.
-- Idempotente: solo toca los body que son arrays. Igual a blocksToDoc de db/blog-body.ts.
UPDATE "post"
SET "body" = jsonb_build_object(
  'type', 'doc',
  'content', COALESCE((
    SELECT jsonb_agg(
      CASE el->>'type'
        WHEN 'p' THEN jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', el->>'text')))
        WHEN 'h2' THEN jsonb_build_object(
          'type', 'heading',
          'attrs', jsonb_build_object('level', 2),
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', el->>'text')))
        WHEN 'tip' THEN jsonb_build_object(
          'type', 'tip',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', el->>'text')))
        WHEN 'summary' THEN jsonb_build_object(
          'type', 'summary',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', el->>'text')))
        WHEN 'image' THEN jsonb_build_object(
          'type', 'image',
          'attrs', jsonb_build_object(
            'mediaId', el->'mediaId',
            'alt', COALESCE(el->'alt', 'null'::jsonb),
            'caption', COALESCE(el->'caption', 'null'::jsonb)))
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements("body") WITH ORDINALITY AS t(el, ord)
  ), '[]'::jsonb)
)
WHERE jsonb_typeof("body") = 'array';
