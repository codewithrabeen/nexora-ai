"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  type SandpackFiles,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Code2,
  ExternalLink,
  Folder,
  History,
  LoaderCircle,
  Monitor,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

type ProjectFile = {
  path: string;
  content: string;
};

type Project = {
  _id: string;
  name: string;
  description: string;
  prompt: string;
  status: "draft" | "generating" | "ready" | "error";
  files: ProjectFile[];
  updatedAt: string;
};

type SaveStatus = "saved" | "saving" | "error";

type SandpackWorkspace = {
  files: SandpackFiles;
  entry: string;
  activeFile: string;
};

type AIChange = {
  path: string;
  action: "create" | "update" | "delete";
  content?: string;
};

type ProjectVersion = {
  version: number;
  label: string;
  createdAt: string;
  fileCount: number;
};

const ENTRY_CANDIDATES = [
  "/src/index.tsx",
  "/src/index.ts",
  "/src/index.jsx",
  "/src/index.js",
  "/src/main.tsx",
  "/src/main.jsx",
  "/index.tsx",
  "/index.jsx",
  "/index.js",
];

const APP_FILE_REGEX = /(^|\/)app\.(jsx|tsx|js|ts)$/i;
const INDEX_CSS_REGEX = /(^|\/)index\.css$/i;

function toSandpackPath(path: string): string {
  const trimmed = path.trim().replace(/^\.\//, "");
  return `/${trimmed}`;
}

function fromSandpackPath(path: string): string {
  return path.replace(/^\/+/, "");
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());

  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

function flattenSandpackFiles(
  files: SandpackFiles | Record<string, { code: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  Object.entries(files).forEach(([path, file]) => {
    result[path] = typeof file === "string" ? file : file.code;
  });

  return result;
}

function buildEntryCode(
  appImportPath: string | null,
  cssFilePath: string | null
): string {
  const lines = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
  ];

  if (appImportPath) {
    lines.push(`import App from "${appImportPath}";`);
  }

  if (cssFilePath) {
    lines.push(`import "${cssFilePath}";`);
  }

  lines.push(
    "",
    'const rootElement = document.getElementById("root");',
    "",
    "if (rootElement) {"
  );

  if (appImportPath) {
    lines.push("  createRoot(rootElement).render(<App />);");
  } else {
    lines.push(
      '  createRoot(rootElement).render(<div style={{ fontFamily: "sans-serif", padding: 24 }}>No App component found in this project.</div>);'
    );
  }

  lines.push("}", "");
  return lines.join("\n");
}

function buildWorkspaceFromProjectFiles(
  projectFiles: ProjectFile[]
): SandpackWorkspace {
  const files: SandpackFiles = {};

  projectFiles.forEach((file) => {
    files[toSandpackPath(file.path)] = { code: file.content };
  });

  const existingEntry = ENTRY_CANDIDATES.find(
    (candidate) => files[candidate]
  );

  const appFilePath = Object.keys(files).find((path) =>
    APP_FILE_REGEX.test(path)
  );

  const cssFilePath = Object.keys(files).find((path) =>
    INDEX_CSS_REGEX.test(path)
  );

  let entry = existingEntry;

  if (!entry) {
    const appImportPath = appFilePath
      ? `.${appFilePath.replace(/\.(jsx|tsx|js|ts)$/, "")}`
      : null;

    entry = "/index.js";
    files[entry] = {
      code: buildEntryCode(appImportPath, cssFilePath ?? null),
    };
  }

  return {
    files,
    entry,
    activeFile: appFilePath ?? entry,
  };
}

const SANDBOX_DEPENDENCIES = {
  "lucide-react": "latest",
};

const nexoraSandpackTheme = {
  colors: {
    surface1: "#101015",
    surface2: "#16161c",
    surface3: "#1d1d25",
    clickable: "#9898a6",
    base: "#e6e6ea",
    disabled: "#4b4b57",
    hover: "#ffffff",
    accent: "#8b5cf6",
    error: "#f87171",
    errorSurface: "#3b1d1d",
  },
  syntax: {
    plain: "#e6e6ea",
    comment: {
      color: "#6b7280",
      fontStyle: "italic" as const,
    },
    keyword: "#c084fc",
    tag: "#f472b6",
    punctuation: "#9898a6",
    definition: "#60a5fa",
    property: "#38bdf8",
    static: "#fbbf24",
    string: "#34d399",
  },
  font: {
    body: "'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    size: "13px",
    lineHeight: "20px",
  },
};

type WorkspaceBridgeProps = {
  onFilesChange: (files: Record<string, string>) => void;
  onActiveFileChange: (path: string) => void;
};

function WorkspaceBridge({
  onFilesChange,
  onActiveFileChange,
}: WorkspaceBridgeProps) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    onFilesChange(flattenSandpackFiles(sandpack.files));
  }, [sandpack.files, onFilesChange]);

  useEffect(() => {
    onActiveFileChange(sandpack.activeFile);
  }, [sandpack.activeFile, onActiveFileChange]);

  return null;
}

type AIAssistantProps = {
  projectId: string;
  hasUnsavedChanges: boolean;
  onProjectUpdated: (updatedProject: Project) => void;
};

function AIAssistant({
  projectId,
  hasUnsavedChanges,
  onProjectUpdated,
}: AIAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [lastChanges, setLastChanges] = useState<AIChange[]>([]);

  const submitEdit = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || isEditing) return;

    if (hasUnsavedChanges) {
      setAiError(
        "Save your manual changes before asking AI to edit the project."
      );
      return;
    }

    setIsEditing(true);
    setAiError("");
    setAiMessage("");
    setLastChanges([]);

    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: cleanPrompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "AI editing failed.");
      }

      if (!data.project) {
        throw new Error(
          "AI updated the project, but no project data was returned."
        );
      }

      onProjectUpdated(data.project as Project);
      setAiMessage(
        data.summary || "AI successfully updated your website."
      );
      setLastChanges(
        Array.isArray(data.changes) ? (data.changes as AIChange[]) : []
      );
      setPrompt("");
    } catch (error) {
      console.error("AI edit failed:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : "AI editing failed. Please try again."
      );
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submitEdit();
    }
  };

  const suggestions = [
    "Add a pricing section",
    "Make the hero section more modern",
    "Add a testimonials section",
    "Improve the mobile layout",
  ];

  return (
    <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101015]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600/15">
            <Sparkles size={15} className="text-violet-300" />
          </div>
          <div>
            <div className="text-sm font-medium">AI Assistant</div>
            <div className="text-[10px] text-zinc-500">
              Modify your website with AI
            </div>
          </div>
        </div>
        <WandSparkles size={15} className="text-zinc-600" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto p-4">
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.06] p-3.5">
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-300" />
              <div>
                <p className="text-xs font-medium text-violet-200">
                  What would you like to change?
                </p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                  Describe a feature, design change, layout improvement, or
                  anything else you want Nexora to modify.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Try asking
            </p>
            <div className="space-y-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  disabled={isEditing}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[11px] text-zinc-400 transition hover:border-violet-500/20 hover:bg-violet-500/[0.05] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {aiError && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-[11px] leading-5 text-red-300">{aiError}</p>
              </div>
            </div>
          )}

          {aiMessage && !aiError && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-emerald-400"
                />
                <div className="min-w-0">
                  <p className="text-[11px] leading-5 text-emerald-300">
                    {aiMessage}
                  </p>
                  {lastChanges.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lastChanges.map((change) => (
                        <div
                          key={`${change.action}-${change.path}`}
                          className="flex items-center gap-2 text-[10px] text-zinc-500"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              change.action === "create"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : change.action === "delete"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-violet-500/10 text-violet-300"
                            }`}
                          >
                            {change.action}
                          </span>
                          <span className="truncate">{change.path}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-[11px] leading-5 text-amber-300">
                  Save your manual changes before using AI. This prevents AI
                  edits from overwriting unsaved work.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <div className="rounded-xl border border-white/[0.1] bg-[#0b0b0f] focus-within:border-violet-500/40">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isEditing}
              rows={4}
              maxLength={10_000}
              placeholder="Ask Nexora to modify your website..."
              className="w-full resize-none bg-transparent px-3.5 pt-3 text-xs leading-5 text-zinc-200 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="text-[9px] text-zinc-600">Ctrl + Enter to send</span>
              <button
                type="button"
                onClick={() => void submitEdit()}
                disabled={isEditing || !prompt.trim() || hasUnsavedChanges}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isEditing ? (
                  <>
                    <LoaderCircle size={13} className="animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Ask AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [workspace, setWorkspace] = useState<SandpackWorkspace | null>(null);
  const [currentFiles, setCurrentFiles] = useState<Record<string, string>>({});
  const [savedFiles, setSavedFiles] = useState<Record<string, string>>({});
  const [selectedPath, setSelectedPath] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveMessage, setSaveMessage] = useState("");
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState("");

  const handleAIProjectUpdated = useCallback((updatedProject: Project) => {
    const workspaceData = buildWorkspaceFromProjectFiles(updatedProject.files ?? []);
    const flattenedFiles = flattenSandpackFiles(workspaceData.files);

    setProject(updatedProject);
    setWorkspace(workspaceData);
    setCurrentFiles(flattenedFiles);
    setSavedFiles(flattenedFiles);
    setSelectedPath(fromSandpackPath(workspaceData.activeFile));
    setSaveStatus("saved");
    setSaveMessage("AI changes were saved to MongoDB.");
    setWorkspaceVersion((value) => value + 1);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!projectId) return;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/history`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load history.");
      }

      setVersions(Array.isArray(data.versions) ? data.versions : []);
    } catch (historyLoadError) {
      console.error("Failed to load history:", historyLoadError);
      setHistoryError(
        historyLoadError instanceof Error
          ? historyLoadError.message
          : "Failed to load history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  const restoreVersion = useCallback(
    async (version: number) => {
      const confirmed = window.confirm(
        `Restore version ${version}? Your current project will be saved first so the restore can be undone.`
      );

      if (!confirmed) return;

      setRestoringVersion(version);
      setHistoryError("");
      setSaveMessage("");

      try {
        const response = await fetch(`/api/projects/${projectId}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to restore version.");
        }

        if (data.project) {
          handleAIProjectUpdated(data.project as Project);
        }

        setHistoryOpen(false);
        await loadHistory();
      } catch (restoreError) {
        console.error("Failed to restore version:", restoreError);
        setHistoryError(
          restoreError instanceof Error
            ? restoreError.message
            : "Failed to restore version."
        );
      } finally {
        setRestoringVersion(null);
      }
    },
    [handleAIProjectUpdated, loadHistory, projectId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      if (!projectId) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load project.");
        }

        const loadedProject = data.project as Project;
        const workspaceData = buildWorkspaceFromProjectFiles(
          loadedProject.files ?? []
        );
        const flattenedFiles = flattenSandpackFiles(workspaceData.files);

        setProject(loadedProject);
        setWorkspace(workspaceData);
        setCurrentFiles(flattenedFiles);
        setSavedFiles(flattenedFiles);
        setSelectedPath(fromSandpackPath(workspaceData.activeFile));
        setSaveStatus("saved");
        setSaveMessage("");
      } catch (loadError) {
        if (cancelled) return;

        console.error("Failed to load project:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load project."
        );
        setProject(null);
        setWorkspace(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /**
   * Load version history once the project id is known.
   *
   * `loadHistory` sets state (setHistoryLoading/setHistoryError) as its
   * very first synchronous statement, before any `await`. Calling it
   * directly inside the effect body counts, to the
   * `react-hooks/set-state-in-effect` rule, as a synchronous setState
   * reachable from the effect's render-phase execution. Deferring the
   * call into a `setTimeout` callback turns it into exactly the pattern
   * the rule allows ("calling setState in a callback function when
   * external state changes") instead of an inline cascading update.
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadHistory]);

  const handleFilesChange = useCallback((files: Record<string, string>) => {
    setCurrentFiles((previous) => {
      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(files);

      if (previousKeys.length !== nextKeys.length) return files;

      for (const key of nextKeys) {
        if (previous[key] !== files[key]) return files;
      }

      return previous;
    });
  }, []);

  const handleActiveFileChange = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    const currentKeys = Object.keys(currentFiles);
    const savedKeys = Object.keys(savedFiles);

    if (currentKeys.length !== savedKeys.length) return true;

    return currentKeys.some((key) => currentFiles[key] !== savedFiles[key]);
  }, [currentFiles, savedFiles]);

  const isSelectedFileDirty = selectedPath
    ? currentFiles[selectedPath] !== savedFiles[selectedPath]
    : false;

  const customSetup = useMemo(
    () => ({
      entry: workspace?.entry ?? "/index.js",
      dependencies: SANDBOX_DEPENDENCIES,
    }),
    [workspace?.entry]
  );

  const sandpackOptions = useMemo(
    () => ({
      activeFile: workspace?.activeFile ?? "/index.js",
      visibleFiles: workspace ? [workspace.activeFile] : [],
      autorun: true,
    }),
    [workspace]
  );

  const saveProject = async () => {
    if (!project || saveStatus === "saving" || !hasUnsavedChanges) return;

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const filesToSave: ProjectFile[] = Object.entries(currentFiles).map(
        ([path, content]) => ({
          path: fromSandpackPath(path),
          content,
        })
      );

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesToSave }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not save project.");
      }

      setProject(data.project as Project);
      setSavedFiles(currentFiles);
      setSaveStatus("saved");
      setSaveMessage("All files saved to MongoDB.");
    } catch (saveError) {
      console.error("Save project failed:", saveError);
      setSaveStatus("error");
      setSaveMessage(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save changes."
      );
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090d] text-zinc-400">
        <LoaderCircle className="mr-3 animate-spin" size={20} />
        Loading your workspace...
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090d] px-5 text-center text-white">
        <AlertCircle size={32} className="text-red-400" />
        <h1 className="text-xl font-semibold">Unable to open project</h1>
        <p className="text-sm text-zinc-400">
          {error || "This project could not be found."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm transition hover:bg-violet-500"
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090d] px-5 text-center text-white">
        <AlertCircle size={32} className="text-amber-400" />
        <h1 className="text-xl font-semibold">No files generated yet</h1>
        <p className="text-sm text-zinc-400">
          This project doesn&apos;t contain any generated files yet.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm transition hover:bg-violet-500"
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#09090d] text-white">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back to dashboard"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <CheckCircle2 size={12} className="text-emerald-400" />
              {project.status === "ready" ? "Generated" : project.status}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              aria-pressed={previewMode === "desktop"}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition ${
                previewMode === "desktop"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Monitor size={15} />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              aria-pressed={previewMode === "mobile"}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition ${
                previewMode === "mobile"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Smartphone size={15} />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setHistoryOpen(true);
              void loadHistory();
            }}
            className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white sm:text-sm"
          >
            <History size={15} />
            <span className="hidden sm:inline">History</span>
            {versions.length > 0 && (
              <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-300">
                {versions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={saveProject}
            disabled={saveStatus === "saving" || !hasUnsavedChanges}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
          >
            {saveStatus === "saving" ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {saveStatus === "saving"
              ? "Saving..."
              : hasUnsavedChanges
                ? "Save changes"
                : "Save"}
          </button>
        </div>
      </header>

      <div className="border-b border-white/[0.07] px-5 py-3 sm:px-6">
        <p className="break-words text-xs leading-5 text-zinc-500">
          <span className="text-violet-300">Website prompt</span>
          <span className="mx-2">/</span>
          {project.prompt}
        </p>
        {saveMessage && (
          <p
            role="status"
            className={`mt-2 text-xs ${
              saveStatus === "error" ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </div>

      <SandpackProvider
        key={`${project._id}-${workspaceVersion}`}
        template="react"
        theme={nexoraSandpackTheme}
        files={workspace.files}
        customSetup={customSetup}
        options={sandpackOptions}
      >
        <WorkspaceBridge
          onFilesChange={handleFilesChange}
          onActiveFileChange={handleActiveFileChange}
        />

        <section className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[220px_minmax(0,0.8fr)_minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:p-5">
          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101015]">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.08] px-4 text-sm font-medium">
              <Folder size={15} className="text-violet-300" />
              Files
              <span className="ml-auto text-xs font-normal text-zinc-500">
                {Object.keys(workspace.files).length}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <SandpackFileExplorer style={{ height: "100%" }} />
            </div>
          </div>

          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101015]">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Code2 size={16} className="text-violet-300" />
                <span className="truncate">{selectedPath || "Code editor"}</span>
                {isSelectedFileDirty && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-amber-400"
                    title="Unsaved changes"
                  />
                )}
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {Object.keys(workspace.files).length} files
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                showInlineErrors
                closableTabs
                wrapContent
                style={{ height: "100%" }}
              />
            </div>
          </div>

          <AIAssistant
            projectId={projectId}
            hasUnsavedChanges={hasUnsavedChanges}
            onProjectUpdated={handleAIProjectUpdated}
          />

          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101015]">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ExternalLink size={15} className="text-violet-300" />
                Live preview
              </div>
              <span className="text-xs text-zinc-500">
                {previewMode === "desktop"
                  ? "Responsive desktop"
                  : "Mobile · 375px"}
              </span>
            </div>
            <div className="flex min-h-[480px] flex-1 items-start justify-center overflow-auto bg-[#08080b] p-3 sm:p-5">
              <div
                className={`min-h-[460px] overflow-hidden rounded-xl bg-white transition-all duration-300 ${
                  previewMode === "mobile"
                    ? "w-[375px] max-w-full border-[5px] border-zinc-700"
                    : "w-full"
                }`}
              >
                <SandpackPreview
                  showOpenInCodeSandbox={false}
                  showRefreshButton
                  showNavigator={false}
                  style={{
                    width: "100%",
                    height:
                      previewMode === "mobile" ? "720px" : "min(720px, 75vh)",
                    minHeight: "460px",
                    border: 0,
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </SandpackProvider>

      <footer className="border-t border-white/[0.07] px-5 py-3 text-center text-xs text-zinc-600">
        Nexora AI · Generated code runs in a separate preview frame.
      </footer>

      {historyOpen && (
        <>
          <button
            type="button"
            aria-label="Close history"
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          />

          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.1] bg-[#0d0d12] shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10">
                  <History size={17} className="text-violet-300" />
                </div>
                <div>
                  <div>
  <h2 className="text-sm font-semibold text-zinc-100">
    Version History
  </h2>

  <p className="mt-0.5 text-[10px] text-zinc-500">
    {versions.length}/20 versions saved
  </p>
</div>


                  <p className="text-[10px] text-zinc-500">
                    Restore a previous project snapshot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
                className="flex size-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {historyError && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                    <p className="text-xs leading-5 text-red-300">{historyError}</p>
                  </div>
                </div>
              )}

              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-xs text-zinc-500">
                  <LoaderCircle size={16} className="mr-2 animate-spin" />
                  Loading history...
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 text-center">
                  <History size={22} className="mx-auto text-zinc-600" />
                  <p className="mt-3 text-sm font-medium text-zinc-300">
                    No versions yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Successful AI edits will automatically appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version, index) => {
                    
                    const isRestoring = restoringVersion === version.version;

                    const isLatest = index === 0;

                    return (
                      <div
                        key={version.version}
                        className="relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-violet-500/20"
                      >
                        {index < versions.length - 1 && (
                          <span className="absolute left-[23px] top-[58px] h-[calc(100%+12px)] w-px bg-white/[0.06]" />
                        )}

                        <div className="relative flex items-start gap-3">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-[10px] font-semibold text-violet-300">
                            {version.version}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
  <h3
    title={version.label}
    className="truncate text-xs font-medium text-zinc-200"
  >
    {version.label || `Version ${version.version}`}
  </h3>

  {isLatest && (
    <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
      Latest
    </span>
  )}
</div>
                               <p className="mt-1 text-[10px] text-zinc-600">
  {formatRelativeTime(version.createdAt)} · {version.fileCount} files
</p>
                              </div>

                              <button
                                type="button"
                                onClick={() => void restoreVersion(version.version)}
                                disabled={restoringVersion !== null}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-zinc-300 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isRestoring ? (
                                  <LoaderCircle size={12} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={12} />
                                )}
                                {isRestoring ? "Restoring" : "Restore"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
<div className="shrink-0 border-t border-white/[0.08] px-5 py-3">
  <p className="text-[10px] leading-4 text-zinc-600">
    Restoring a version first saves your current project as another
    snapshot, so restores remain reversible.
  </p>

  <p className="mt-1 text-[10px] leading-4 text-zinc-600">
    The latest 20 versions are kept.
  </p>
</div>
          </aside>
        </>
      )}
    </main>
  );
}
