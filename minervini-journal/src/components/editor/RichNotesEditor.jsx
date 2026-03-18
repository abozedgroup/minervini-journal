import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';

export default function RichNotesEditor({ content, onChange, onSave, placeholder = 'اكتب هنا...' }) {
  const saveTimeoutRef = useRef(null);
  const lastContentRef = useRef(null);
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Image.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({ placeholder }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank' } }),
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
          reader.onload = () => {
            editor.chain().focus().setImage({ src: reader.result }).run();
          };
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      lastContentRef.current = json;
      onChange?.(json);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSave?.(json);
        saveTimeoutRef.current = null;
      }, 2000);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = typeof content === 'object' ? JSON.stringify(content) : (content || '{}');
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

  if (!editor) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-s1">
      <div className="tiptap-toolbar p-2 border-b border-border flex flex-wrap gap-1">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''}>U</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive('highlight') ? 'is-active' : ''}>Highlight</button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}>H3</button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>•</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''}>1.</button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'is-active' : ''}>"</button>
      </div>
      <div className="tiptap-toolbar p-2 border-b border-border flex flex-wrap gap-1">
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}>→</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}>≡</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}>←</button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={setLink}>Link</button>
        <button type="button" onClick={addImageFromFile}>صورة (ملف)</button>
        <button type="button" onClick={addImageFromUrl}>صورة (رابط)</button>
        <span className="w-px bg-border mx-1" />
        <button type="button" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>مسح التنسيق</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
