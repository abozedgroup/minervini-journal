export default function Topbar({ title, children }) {
  return (
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
      <h1 className="font-display text-xl text-fg">{title}</h1>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </header>
  );
}
