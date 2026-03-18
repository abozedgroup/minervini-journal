import React, { useCallback, useState } from 'react';
import { defaultExecutionConditions, nanoid } from '../../utils/technicalConditionsSchema';

export default function ExecutionConditions({ data, onChange }) {
  const exec = data || defaultExecutionConditions();
  const [collapsed, setCollapsed] = useState({});
  const [editingId, setEditingId] = useState(null);

  const toggleGroup = useCallback((groupId) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const updateItem = useCallback(
    (groupId, itemId, patch) => {
      const groups = (exec.groups || []).map((g) =>
        g.id === groupId ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : g
      );
      onChange({ ...exec, groups });
    },
    [exec, onChange]
  );

  const addItem = useCallback(
    (groupId) => {
      const groups = (exec.groups || []).map((g) =>
        g.id === groupId ? { ...g, items: [...g.items, { id: nanoid(), enabled: true, text: 'شرط جديد' }] } : g
      );
      onChange({ ...exec, groups });
    },
    [exec, onChange]
  );

  const removeItem = useCallback(
    (groupId, itemId) => {
      const groups = (exec.groups || []).map((g) =>
        g.id === groupId ? { ...g, items: g.items.filter((it) => it.id !== itemId) } : g
      );
      onChange({ ...exec, groups });
    },
    [exec, onChange]
  );

  const toggleItem = useCallback(
    (groupId, itemId) => {
      const group = (exec.groups || []).find((g) => g.id === groupId);
      const item = group?.items.find((it) => it.id === itemId);
      if (item) updateItem(groupId, itemId, { enabled: !item.enabled });
    },
    [exec.groups, updateItem]
  );

  const parseTextWithNumber = useCallback((text) => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/\[([\d.]+)\]/);
    return match ? { before: text.slice(0, match.index), num: match[1], after: text.slice(match.index + match[0].length), fullMatch: match[0] } : null;
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-muted text-sm mb-3">ستظهر هذه النقاط في قائمة التحقق قبل التنفيذ عند ربط الاستراتيجية بصفقة.</p>
      {(exec.groups || []).map((group) => {
        const isCollapsed = collapsed[group.id];
        return (
          <div key={group.id} className="border border-border rounded-lg overflow-hidden bg-s1">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between p-3 text-right font-medium text-fg hover:bg-s2/50"
            >
              <span>{group.label}</span>
              <span>{isCollapsed ? '▾' : '▴'}</span>
            </button>
            {!isCollapsed && (
              <div className="p-3 pt-0 space-y-1.5 border-t border-border">
                {group.items.map((item) => (
                  <ExecutionItemRow
                    key={item.id}
                    item={item}
                    parseTextWithNumber={parseTextWithNumber}
                    isEditing={editingId === item.id}
                    onStartEdit={() => setEditingId(item.id)}
                    onEndEdit={() => setEditingId(null)}
                    onToggle={() => toggleItem(group.id, item.id)}
                    onUpdateText={(text) => updateItem(group.id, item.id, { text })}
                    onUpdateNum={(numValue, newText) => updateItem(group.id, item.id, numValue != null ? { numValue, text: newText } : { numValue })}
                    onRemove={() => removeItem(group.id, item.id)}
                  />
                ))}
                <button type="button" onClick={() => addItem(group.id)} className="text-sm text-gold hover:underline mt-1">
                  + إضافة شرط
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExecutionItemRow({ item, parseTextWithNumber, isEditing, onStartEdit, onEndEdit, onToggle, onUpdateText, onUpdateNum, onRemove }) {
  const [localText, setLocalText] = useState(item.text);

  React.useEffect(() => {
    setLocalText(item.text);
  }, [item.text]);

  const handleBlur = () => {
    onUpdateText(localText);
    onEndEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
  };

  const parsed = parseTextWithNumber(item.text);
  const numVal = item.numValue ?? (parsed ? Number(parsed.num) : null);

  const handleNumChange = (e) => {
    const raw = e.target.value;
    const v = raw === '' ? null : Number(raw);
    const newText = parsed && v != null ? item.text.replace(parsed.fullMatch, `[${v}]`) : item.text;
    onUpdateNum(v, newText);
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 px-3 rounded-lg border transition-all border-border ${!item.enabled ? 'opacity-50' : ''}`}
      style={{ background: 'var(--s2)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 w-[22px] h-[22px] rounded flex items-center justify-center text-xs ${item.enabled ? 'bg-teal text-white' : 'bg-s3 text-muted'}`}
      >
        {item.enabled ? '✓' : '○'}
      </button>
      <div className="flex-1 min-w-0" style={{ fontSize: '0.82rem' }}>
        {isEditing ? (
          <input
            type="text"
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-s3 border border-gold/50 rounded px-2 py-1 text-sm text-fg"
            dir="rtl"
            autoFocus
          />
        ) : (
          <span className="block text-right">
            {parsed ? (
              <>
                {parsed.before}
                <input
                  type="number"
                  value={numVal ?? ''}
                  onChange={handleNumChange}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block bg-transparent border-b border-gold/40 text-gold text-center font-mono text-[0.85rem] mx-0.5 outline-none focus:border-gold"
                  style={{ width: 40, minWidth: 35 }}
                  dir="ltr"
                />
                {parsed.after}
              </>
            ) : (
              <button type="button" onClick={onStartEdit} className="text-fg hover:text-gold transition-colors w-full text-right">
                {item.text}
              </button>
            )}
          </span>
        )}
        {!isEditing && parsed && (
          <button type="button" onClick={onStartEdit} className="text-muted hover:text-gold text-xs mt-0.5 block w-full text-right">
            تعديل النص
          </button>
        )}
      </div>
      <button type="button" onClick={onRemove} className="shrink-0 w-[22px] h-[22px] rounded flex items-center justify-center text-red hover:bg-red/20">
        ✕
      </button>
    </div>
  );
}
