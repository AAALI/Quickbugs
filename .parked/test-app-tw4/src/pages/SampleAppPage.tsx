import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const mockUsers = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "active" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Editor", status: "active" },
  { id: 3, name: "Charlie Brown", email: "charlie@example.com", role: "Viewer", status: "inactive" },
  { id: 4, name: "Diana Prince", email: "diana@example.com", role: "Editor", status: "active" },
  { id: 5, name: "Eve Wilson", email: "eve@example.com", role: "Admin", status: "active" },
];

export function SampleAppPage() {
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [counter, setCounter] = useState(0);
  const [showError, setShowError] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);

  const addToast = (msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    addToast(`Form submitted for ${formName}`);
    setTimeout(() => setFormSubmitted(false), 2000);
  };

  const triggerError = () => {
    setShowError(true);
    addToast("Something went wrong!");
    setTimeout(() => setShowError(false), 4000);
  };

  const triggerFetch = async () => {
    try {
      const res = await fetch("https://jsonplaceholder.typicode.com/posts/1");
      const data = await res.json() as { title: string };
      addToast(`Fetched: "${data.title?.slice(0, 30)}…"`);
    } catch {
      addToast("Fetch failed!");
    }
  };

  const triggerFailedFetch = async () => {
    try {
      await fetch("https://httpstat.us/500");
      addToast("Request returned 500");
    } catch {
      addToast("Network error on failed fetch");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Sample App</h1>
        <p className="mt-2 text-gray-500">
          Interactive components to test bug reporting on. Try capturing a
          screenshot or recording while interacting with this page.
        </p>
      </header>

      {/* Toast notifications */}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((msg, i) => (
          <div
            key={i}
            className="animate-in slide-in-from-right rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-lg"
          >
            {msg}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Contact Form</h2>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
              <textarea
                placeholder="Write something…"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Submit
            </button>
            {formSubmitted && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="size-4" /> Submitted successfully!
              </div>
            )}
          </form>
        </div>

        {/* Interactive widgets */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Counter</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCounter((c) => c - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                −
              </button>
              <span className="text-3xl font-bold tabular-nums">{counter}</span>
              <button
                onClick={() => setCounter((c) => c + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                +
              </button>
              <button
                onClick={() => setCounter(0)}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={triggerError}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <XCircle className="size-4" /> Trigger Error
              </button>
              <button
                onClick={() => void triggerFetch()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Fetch Data
              </button>
              <button
                onClick={() => void triggerFailedFetch()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Failing Fetch
              </button>
            </div>
            {showError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                <AlertTriangle className="size-4" />
                Simulated error: Cannot read properties of undefined (reading 'map')
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data table */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Users Table</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{user.id}</td>
                  <td className="px-4 py-2 font-medium">{user.name}</td>
                  <td className="px-4 py-2 text-gray-500">{user.email}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === "Admin"
                        ? "bg-purple-100 text-purple-700"
                        : user.role === "Editor"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
        <strong>Tip:</strong> Use the floating bug button to capture this page while
        interacting with the form, counter, or triggering errors. The network
        logger will automatically capture the fetch requests made by the "Fetch Data"
        and "Failing Fetch" buttons.
      </section>
    </div>
  );
}
