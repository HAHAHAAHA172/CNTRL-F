import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Loader2, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  repoUrl: string
  selectedFile: string | null
  repoReady: boolean
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your codebase assistant. Ask me anything about this repository — where auth is handled, how data flows, where to add a feature, or what a file does.",
}

export default function ChatPanel({ repoUrl, selectedFile, repoReady }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          file_context: selectedFile,
          message: text,
        }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Could not reach the backend. Is it running?' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-context-bar">
        {selectedFile
          ? <><span className="context-label">Context:</span> <code>{selectedFile}</code></>
          : <span className="context-label">No file selected — whole repo context</span>
        }
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div className="msg-avatar">
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="msg-content">
              <pre className="msg-text">{msg.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="msg-avatar"><Bot size={14} /></div>
            <div className="msg-content typing">
              <Loader2 size={14} className="spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={2}
          placeholder={repoReady ? "Ask about this codebase… (Enter to send, Shift+Enter for newline)" : "Analyzing repository, please wait…"}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!repoReady}
        />
        <button
          className="btn-primary send-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim() || !repoReady}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
