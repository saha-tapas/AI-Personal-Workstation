import { useState } from 'react'
import { sendChatMessage } from './chatApi'

function Chat() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || isLoading) return

    setMessages((current) => [...current, { role: 'user', content: message }])
    setDraft('')
    setError('')
    setIsLoading(true)

    try {
      const reply = await sendChatMessage(message)
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form.requestSubmit()
    }
  }

  return <section className="chat-panel" aria-labelledby="chat-title">
    <div className="chat-heading"><div><p className="eyebrow">AI Chat</p><h1 id="chat-title">Talk with your assistant</h1></div><span className="chat-provider">OpenRouter</span></div>
    <div className="chat-messages" aria-live="polite">
      {messages.length === 0 && <div className="chat-empty"><span className="chat-empty-icon" aria-hidden="true">✦</span><p>Start a conversation with your AI assistant.</p><span>Press Enter to send, or Shift+Enter for a new line.</span></div>}
      {messages.map((message, index) => <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}><span className="chat-message-label">{message.role === 'user' ? 'You' : 'Assistant'}</span><p>{message.content}</p></div>)}
      {isLoading && <div className="chat-message chat-message--assistant chat-message--loading"><span className="chat-message-label">Assistant</span><p>Thinking<span className="loading-dots">...</span></p></div>}
    </div>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={handleSubmit}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything..." aria-label="Message" rows="3" disabled={isLoading} /><button type="submit" disabled={!draft.trim() || isLoading}>{isLoading ? 'Sending...' : 'Send'}</button></form>
  </section>
}

export default Chat
