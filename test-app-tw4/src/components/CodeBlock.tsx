export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-900 text-sm">
      {title && (
        <div className="border-b border-gray-700 bg-gray-800 px-4 py-2 text-xs font-medium text-gray-400">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
