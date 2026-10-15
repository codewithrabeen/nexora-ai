"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Globe,
  LayoutDashboard,
  Plus,
  Settings2,
  Sparkles,
  WandSparkles,
  RefreshCw,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Code2,
  Trash2,
  X,
  LoaderCircle,
} from "lucide-react";

type ProjectStatus = "draft" | "generating" | "ready" | "error";

type Project = {
  _id: string;
  name: string;
  description: string;
  prompt: string;
  status: ProjectStatus;
  framework: string;
  createdAt: string;
  updatedAt: string;
};

const ideas = [
  {
    title: "Restaurant website",
    description:
      "A premium restaurant website with a menu and reservations.",
    icon: "🍜",
  },
  {
    title: "SaaS landing page",
    description:
      "A modern landing page for a productivity startup.",
    icon: "🚀",
  },
  {
    title: "Personal portfolio",
    description:
      "A creative portfolio with projects and contact details.",
    icon: "✦",
  },
];

const statusStyles: Record<ProjectStatus, string> = {
  draft: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
  generating:
    "border-violet-500/20 bg-violet-500/10 text-violet-300",
  ready:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  error:
    "border-red-500/20 bg-red-500/10 text-red-300",
};

export default function Home() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [projectToDelete, setProjectToDelete] =
    useState<Project | null>(null);

  const [deleting, setDeleting] = useState(false);

  async function loadProjects() {
    setLoadingProjects(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Could not load your websites."
        );
      }

      setProjects(data.projects);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading websites."
      );
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;

      await loadProjects();
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    let projectId: string | undefined;

    try {
      const createResponse = await fetch(
        "/api/projects",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: cleanPrompt,
          }),
        }
      );

      const createData =
        await createResponse.json();

      if (
        !createResponse.ok ||
        !createData.success
      ) {
        throw new Error(
          createData.message ||
            "Could not create your project."
        );
      }

      projectId = createData.project._id;

      setPrompt("");

      setNotice(
        "Project created. Generating your website..."
      );

      await loadProjects();

      const generateResponse = await fetch(
        "/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            projectId,
          }),
        }
      );

      const generateData =
        await generateResponse.json();

      if (
        !generateResponse.ok ||
        !generateData.success
      ) {
        throw new Error(
          generateData.message ||
            "Website generation failed."
        );
      }

      await loadProjects();

      setNotice(
        "Your website has been generated and saved!"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );

      await loadProjects();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (!projectToDelete || deleting) {
      return;
    }

    setDeleting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/projects/${projectToDelete._id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Could not delete this project."
        );
      }

      setProjects((currentProjects) =>
        currentProjects.filter(
          (project) =>
            project._id !==
            projectToDelete._id
        )
      );

      setProjectToDelete(null);

      setNotice(
        `"${projectToDelete.name}" was deleted successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete project."
      );
    } finally {
      setDeleting(false);
    }
  }

  function openEditor(project: Project) {
    if (project.status !== "ready") return;

    router.push(
      `/projects/${project._id}`
    );
  }

  return (
    <main className="flex min-h-screen bg-[#09090d] text-white">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.08] bg-[#0c0c11] p-5 md:flex">
        <Link
          href="/"
          className="mb-10 flex items-center gap-3"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-950/50">
            <WandSparkles size={20} />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Nexora
            <span className="text-violet-400">
              {" "}
              AI
            </span>
          </span>
        </Link>

        <button
          onClick={() => {
            setPrompt("");
            setError("");
            setNotice("");

            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium transition hover:bg-violet-500"
        >
          <Plus size={17} />
          New website
        </button>

        <p className="mb-3 mt-9 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
          Workspace
        </p>

        <nav className="space-y-1">
          <Link
            href="#home"
            className="flex items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-2.5 text-sm text-white"
          >
            <LayoutDashboard size={17} />
            Overview
          </Link>

          <Link
            href="#projects"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <Globe size={17} />
            My websites

            <span className="ml-auto text-xs text-zinc-500">
              {projects.length}
            </span>
          </Link>
        </nav>

        <div className="mt-auto border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={() =>
              setNotice(
                "Workspace settings are not available yet."
              )
            }
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white"
          >
            <Settings2 size={17} />
            Settings
          </button>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-300">
              R
            </div>

            <div>
              <p className="text-sm font-medium">
                Rabeen
              </p>

              <p className="text-xs text-zinc-500">
                Free workspace
              </p>
            </div>
          </div>
        </div>
      </aside>

      <section
        id="home"
        className="min-w-0 flex-1"
      >
        <header className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5 sm:px-8">
          <p className="text-sm text-zinc-400">
            Workspace{" "}
            <span className="mx-2 text-zinc-600">
              /
            </span>

            <span className="text-white">
              Overview
            </span>
          </p>

          <div className="flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-3 py-1.5 text-xs text-violet-300">
            <Sparkles size={13} />
            AI workspace
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300 shadow-xl shadow-violet-950/20">
              <Sparkles size={25} />
            </div>

            <p className="mb-3 text-sm font-medium text-violet-300">
              YOUR IDEAS, BUILT WITH AI
            </p>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              What will{" "}
              <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                create today?
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-400 sm:text-base">
              Describe your idea. Nexora AI
              will help you turn it into a
              website you can preview,
              customize and publish.
            </p>

            <div className="mt-9 rounded-2xl border border-white/[0.12] bg-[#111116] p-3 text-left shadow-2xl shadow-black/20 transition focus-within:border-violet-500/60">
              <textarea
                value={prompt}
                onChange={(event) =>
                  setPrompt(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent
                      .isComposing
                  ) {
                    event.preventDefault();

                    void handleGenerate();
                  }
                }}
                placeholder="Describe the website you want to build..."
                rows={4}
                maxLength={10000}
                className="w-full resize-none bg-transparent p-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600"
              />

              <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                <p className="pl-2 text-xs text-zinc-500">
                  {prompt.length}/10,000
                  characters
                </p>

                <button
                  onClick={() =>
                    void handleGenerate()
                  }
                  disabled={
                    !prompt.trim() ||
                    saving
                  }
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? "Generating..."
                    : "Generate"}

                  {saving ? (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <ArrowUp size={16} />
                  )}
                </button>
              </div>
            </div>

            {notice && (
              <p
                role="status"
                className="mt-4 flex items-center justify-center gap-2 text-sm text-emerald-400"
              >
                <CheckCircle2
                  size={16}
                />
                {notice}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400"
              >
                <AlertCircle
                  size={16}
                />
                {error}
              </p>
            )}
          </div>

          <div className="mt-16">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Start with an idea
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Choose a starting point for
                your next website.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.map((idea) => (
                <button
                  key={idea.title}
                  onClick={() =>
                    setPrompt(
                      `Build a ${idea.title.toLowerCase()}. ${idea.description}`
                    )
                  }
                  className="group rounded-2xl border border-white/[0.08] bg-[#101015] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-[#14131c]"
                >
                  <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-xl">
                    {idea.icon}
                  </div>

                  <h3 className="font-medium">
                    {idea.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {idea.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-xs font-medium text-violet-300 opacity-80 group-hover:opacity-100">
                    <Sparkles size={13} />
                    Use this idea
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            id="projects"
            className="mt-16 scroll-mt-8"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  My websites
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Your saved website ideas,
                  stored in MongoDB.
                </p>
              </div>

              <button
                onClick={() =>
                  void loadProjects()
                }
                disabled={loadingProjects}
                className="flex items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={
                    loadingProjects
                      ? "animate-spin"
                      : ""
                  }
                />
                Refresh
              </button>
            </div>

            {loadingProjects ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#101015] p-8 text-center text-sm text-zinc-500">
                Loading your websites...
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.12] p-8 text-center">
                <Globe
                  className="mx-auto mb-3 text-zinc-500"
                  size={25}
                />

                <p className="text-sm font-medium text-zinc-300">
                  No websites yet
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Describe an idea above to
                  create your first project.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((project) => {
                  const isReady =
                    project.status ===
                    "ready";

                  return (
                    <article
                      key={project._id}
                      className="rounded-2xl border border-white/[0.08] bg-[#101015] p-5 transition hover:border-violet-400/25"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-violet-300">
                          <Globe size={18} />
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize ${
                            statusStyles[
                              project.status
                            ] ??
                            statusStyles.draft
                          }`}
                        >
                          {project.status ===
                          "ready" ? (
                            <CheckCircle2
                              size={12}
                            />
                          ) : project.status ===
                            "error" ? (
                            <AlertCircle
                              size={12}
                            />
                          ) : (
                            <Clock3
                              size={12}
                            />
                          )}

                          {project.status}
                        </span>
                      </div>

                      <h3 className="mt-4 font-medium">
                        {project.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                        {project.prompt}
                      </p>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                        <div className="flex flex-col gap-1 text-xs text-zinc-500">
                          <span>
                            {project.framework ||
                              "React"}
                          </span>

                          <span>
                            {new Date(
                              project.updatedAt
                            ).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setProjectToDelete(
                                project
                              )
                            }
                            aria-label={`Delete ${project.name}`}
                            title="Delete project"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>

                          <button
                            type="button"
                            disabled={!isReady}
                            onClick={() =>
                              openEditor(
                                project
                              )
                            }
                            title={
                              isReady
                                ? "Open this website in the editor"
                                : "This project must be ready before it can be edited"
                            }
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Code2
                              size={14}
                            />
                            Open Editor
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="mt-16 border-t border-white/[0.07] pt-5 text-center text-xs text-zinc-600">
            Nexora AI · Turn your imagination
            into a website.
          </footer>
        </div>
      </section>

      {/* =====================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!deleting) {
                setProjectToDelete(null);
              }
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111116] p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400">
                <Trash2 size={20} />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!deleting) {
                    setProjectToDelete(
                      null
                    );
                  }
                }}
                disabled={deleting}
                aria-label="Close dialog"
                className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <h2
              id="delete-project-title"
              className="mt-5 text-lg font-semibold"
            >
              Delete this website?
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              You are about to permanently
              delete{" "}
              <span className="font-medium text-white">
                {projectToDelete.name}
              </span>
              . All generated files and
              project data stored in MongoDB
              will be removed.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setProjectToDelete(null)
                }
                disabled={deleting}
                className="rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleDeleteProject()
                }
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                )}

                {deleting
                  ? "Deleting..."
                  : "Delete website"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}