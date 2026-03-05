import React, { useState, useEffect, useRef } from 'react';
import { Usuario } from '../types';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  required?: boolean;
}

export default function MentionInput({ value, onChange, placeholder, className, rows = 3, required = false }: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionList, setMentionList] = useState<Usuario[]>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchMentions = async () => {
      if (mentionQuery.length < 1) {
        setMentionList([]);
        return;
      }
      try {
        const res = await fetch(`/api/users?q=${mentionQuery}`);
        if (res.ok) {
          setMentionList(await res.json());
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (showMentions) {
      fetchMentions();
    }
  }, [mentionQuery, showMentions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const selectionStart = e.target.selectionStart;
    setCursorPos(selectionStart);
    onChange(newValue);

    // Check for @ mention
    const textBeforeCursor = newValue.substring(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.substring(lastAtIdx + 1);
      // Ensure no space between @ and query
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
  };

  const selectMention = (user: Usuario) => {
    const textBeforeAt = value.substring(0, value.lastIndexOf('@', cursorPos - 1));
    const textAfterCursor = value.substring(cursorPos);
    const newValue = `${textBeforeAt}@${user.codigo_interno} ${textAfterCursor}`;
    onChange(newValue);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        className={className}
        required={required}
      />
      
      {showMentions && mentionList.length > 0 && (
        <div className="absolute z-50 bottom-full left-0 w-64 bg-[#1A1A1B] border border-[#343536] rounded-lg shadow-xl mb-1 max-h-48 overflow-y-auto divide-y divide-[#343536]">
          {mentionList.map(u => (
            <button
              key={u.id}
              onClick={() => selectMention(u)}
              className="w-full p-2 flex items-center gap-2 hover:bg-[#39FF14]/10 text-left transition-colors"
            >
              <div className="w-6 h-6 bg-[#0D2D0D] rounded-full flex items-center justify-center text-[#39FF14] text-[10px] font-bold">
                {u.nome?.[0] || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{u.nome}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <p className="text-[10px] text-[#39FF14] font-mono uppercase">{u.codigo_interno}</p>
                  <span className="text-[10px] text-[#818384]">•</span>
                  <p className="text-[10px] text-[#818384] uppercase font-bold">{u.organizacao_militar}</p>
                  <span className="text-[10px] text-[#818384]">•</span>
                  <p className="text-[10px] text-[#818384] uppercase font-bold">{u.funcao}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
