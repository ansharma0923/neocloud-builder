interface ChatPageProps {
  params: { chatId: string };
}

export default function ChatPage({ params }: ChatPageProps) {
  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-text-primary">NeoCloud Builder</h1>
        <span className="text-xs text-text-muted">Chat: {params.chatId}</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Message list */}
        <section className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-text-secondary">
              Start a conversation to plan your AI infrastructure.
            </p>
          </div>
        </section>
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <input
            type="text"
            placeholder="Describe your infrastructure requirements…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            readOnly
          />
          <button
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition hover:bg-primary-hover"
            disabled
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
