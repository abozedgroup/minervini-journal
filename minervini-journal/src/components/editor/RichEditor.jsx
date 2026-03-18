import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

const DEBOUNCE_MS = 1500;
const SAVED_BADGE_MS = 2000;

export default function RichEditor({ content, onChange, placeholder = 'اكتب هنا...' }) {
  const [saved, setSaved] = useState(false);
  const [writing, setWriting] = useState(false);
  const debounceRef = useRef(null);
  const savedTimeoutRef = useRef(null);
  // ← useRef pattern: always calls the latest onChange without recreating the editor
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextAlign.configure({ types: ['paragraph', 'heading'] }),
    Highlight.configure({ multicolor: false }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank' } }),
    Image.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({ placeholder }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: content ?? null,
    editorProps: {
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files?.length && files[0].type.startsWith('image/')) {
          event.preventDefault();
          const file = files[0];
          const reader = new FileReader();
          reader.onload = () => editor?.chain().focus().setImage({ src: reader.result }).run();
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      onChangeRef.current?.(json);
      setWriting(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        setWriting(false);
        setSaved(true);
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => {
          setSaved(false);
          savedTimeoutRef.current = null;
        }, SAVED_BADGE_MS);
      }, DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = typeof content === 'object' && content !== null ? JSON.stringify(content) : '{}';
    if (current !== next) editor.commands.setContent(content ?? '');
  }, [content, editor]);

  const addImageFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => editor?.chain().focus().setImage({ src: reader.result }).run();
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [editor]);

  const addImageFromUrl = useCallback(() => {
    const url = window.prompt('رابط الصورة:');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const setLink = useCallback(() => {
    const url = window.prompt('الرابط:');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const btn = 'w-7 h-7 rounded flex items-center justify-center text-sm font-medium transition-colors hover:bg-s3 ';
  const btnActive = 'bg-gold text-black hover:bg-gold';

  if (!editor) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-s1 flex flex-col">
      <div className="sticky top-0 z-10 bg-s2 border-b border-border p-2 flex flex-wrap items-center gap-1">
        {/* Group 1 — Text format */}
        <button type="button" title="عريض" className={btn + (editor.isActive('bold') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button type="button" title="مائل" className={btn + (editor.isActive('italic') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" title="تحت خط" className={btn + (editor.isActive('underline') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
        <button type="button" title="تمييز" className={btn + (editor.isActive('highlight') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleHighlight().run()}>Mark</button>
        <span className="w-px h-5 bg-border mx-0.5" />
        {/* Group 2 — Headings */}
        <button type="button" className={btn + (editor.isActive('heading', { level: 1 }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button type="button" className={btn + (editor.isActive('heading', { level: 2 }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" className={btn + (editor.isActive('heading', { level: 3 }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className="w-px h-5 bg-border mx-0.5" />
        {/* Group 3 — Lists */}
        <button type="button" className={btn + (editor.isActive('bulletList') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</button>
        <button type="button" className={btn + (editor.isActive('orderedList') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
        <button type="button" className={btn + (editor.isActive('blockquote') ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</button>
        <span className="w-px h-5 bg-border mx-0.5" />
        {/* Group 4 — Alignment */}
        <button type="button" className={btn + (editor.isActive({ textAlign: 'right' }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="محاذاة لليمين">→</button>
        <button type="button" className={btn + (editor.isActive({ textAlign: 'center' }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="توسيط">≡</button>
        <button type="button" className={btn + (editor.isActive({ textAlign: 'left' }) ? btnActive : 'text-fg')} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="محاذاة لليسار">←</button>
        <span className="w-px h-5 bg-border mx-0.5" />
        {/* Group 5 — Media */}
        <button type="button" className={btn + ' text-fg'} onClick={addImageFromFile} title="رفع صورة">📎 رفع صورة</button>
        <button type="button" className={btn + ' text-fg'} onClick={addImageFromUrl} title="رابط صورة">🔗 رابط صورة</button>
        <button type="button" className={btn + ' text-fg'} onClick={setLink} title="إضافة رابط">🔗 إضافة رابط</button>
        <span className="w-px h-5 bg-border mx-0.5" />
        {/* Group 6 */}
        <button type="button" className={btn + ' text-fg'} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="مسح التنسيق">مسح التنسيق</button>
      </div>
      <div className="relative">
        <EditorContent editor={editor} />
        <div className="absolute top-2 left-2 flex items-center gap-2 text-xs">
          {writing && <span className="text-muted">✏️ جاري الكتابة...</span>}
          {saved && <span className="text-teal font-medium animate-pulse">💾 حُفظ</span>}
        </div>
      </div>
    </div>
  );
}
