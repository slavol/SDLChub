"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  createDocumentationPage,
  deleteDocumentationPage,
  DocumentationPage,
  DocumentationRevision,
  generateDocumentationFromTask,
  getDocumentationPageHistory,
  getProjectDocumentationPages,
  updateDocumentationPage,
} from "@/services/documentation";
import { getMyProjects, Project } from "@/services/project";
import { getProjectTasks, Task, TaskStatus } from "@/services/task";
import { useProjectStore } from "@/store/use-project-store";

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const emptyContent = `# New documentation page

## Context

Describe the feature, decision, component or technical flow.

## Implementation details

- 

## Validation

- 

## Maintenance notes

- 
`;

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-300">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;

        if (!line.trim()) {
          return <div key={key} className="h-2" />;
        }

        if (line.startsWith("# ")) {
          return (
            <h1 key={key} className="pt-1 text-2xl font-bold leading-tight text-white">
              {line.replace("# ", "")}
            </h1>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <h2 key={key} className="pt-4 text-lg font-semibold text-white">
              {line.replace("## ", "")}
            </h2>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <p key={key} className="pl-4 text-slate-300">
              <span className="mr-2 text-blue-300">•</span>
              {line.replace("- ", "")}
            </p>
          );
        }

        return (
          <p key={key} className="text-slate-300">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function DocumentationPageRoute() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [pages, setPages] = useState<DocumentationPage[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [selectedPage, setSelectedPage] = useState<DocumentationPage | null>(null);
  const [revisions, setRevisions] = useState<DocumentationRevision[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDoneTaskId, setSelectedDoneTaskId] = useState("");
  const [title, setTitle] = useState("New documentation page");
  const [content, setContent] = useState(emptyContent);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDocumentation = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = projects[0] ?? null;

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      if (!selectedProject) {
        setProject(null);
        setPages([]);
        setDoneTasks([]);
        setSelectedPage(null);
        setRevisions([]);
        return;
      }

      setProject(selectedProject);

      const [remotePages, remoteTasks] = await Promise.all([
        getProjectDocumentationPages(selectedProject.id),
        getProjectTasks(selectedProject.id),
      ]);

      const completedTasks = remoteTasks.filter((task) => task.status === TaskStatus.DONE);
      const nextSelected = remotePages[0] ?? null;

      setPages(remotePages);
      setDoneTasks(completedTasks);
      setSelectedPage(nextSelected);

      if (nextSelected) {
        setTitle(nextSelected.title);
        setContent(nextSelected.content);
        setIsEditing(false);
      } else {
        setTitle("New documentation page");
        setContent(emptyContent);
        setIsEditing(true);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load documentation."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadDocumentation();
  }, [loadDocumentation]);

  useRealtimeEvent((message) => {
    if (message.type === "documentation.changed" && message.project_id === project?.id) {
      loadDocumentation(false);
    }

    if (message.type === "task.changed" && message.project_id === project?.id) {
      loadDocumentation(false);
    }
  }, [loadDocumentation, project?.id]);

  const selectedTask = useMemo(
    () => doneTasks.find((task) => String(task.id) === selectedDoneTaskId),
    [doneTasks, selectedDoneTaskId]
  );

  const loadPageHistory = useCallback(async (pageId: number | null) => {
    if (!pageId) {
      setRevisions([]);
      return;
    }

    setLoadingHistory(true);
    try {
      const history = await getDocumentationPageHistory(pageId);
      setRevisions(history);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load page history."));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadPageHistory(selectedPage?.id ?? null);
  }, [loadPageHistory, selectedPage?.id]);

  const handleNewPage = () => {
    setSelectedPage(null);
    setRevisions([]);
    setTitle("New documentation page");
    setContent(emptyContent);
    setIsEditing(true);
  };

  const handleSelectPage = (page: DocumentationPage) => {
    setSelectedPage(page);
    setTitle(page.title);
    setContent(page.content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!project) return;

    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }

    setSaving(true);

    try {
      if (selectedPage) {
        const updated = await updateDocumentationPage(selectedPage.id, {
          title: title.trim(),
          content,
          task_id: selectedPage.task_id ?? null,
        });

        setPages((current) =>
          current.map((page) => (page.id === updated.id ? updated : page))
        );
        setSelectedPage(updated);
        await loadPageHistory(updated.id);
        setIsEditing(false);
        toast.success("Documentation page updated.");
      } else {
        const created = await createDocumentationPage(project.id, {
          title: title.trim(),
          content,
        });

        setPages((current) => [created, ...current]);
        setSelectedPage(created);
        setRevisions([]);
        setIsEditing(false);
        toast.success("Documentation page created.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save documentation page."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPage) return;

    setSaving(true);

    try {
      await deleteDocumentationPage(selectedPage.id);

      const remaining = pages.filter((page) => page.id !== selectedPage.id);
      const nextPage = remaining[0] ?? null;

      setPages(remaining);
      setSelectedPage(nextPage);

      if (nextPage) {
        setTitle(nextPage.title);
        setContent(nextPage.content);
        setIsEditing(false);
      } else {
        setTitle("New documentation page");
        setContent(emptyContent);
        setIsEditing(true);
      }

      toast.success("Documentation page deleted.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not delete documentation page."));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFromTask = async () => {
    if (!selectedDoneTaskId) {
      toast.error("Choose a Done task first.");
      return;
    }

    setSaving(true);

    try {
      const generated = await generateDocumentationFromTask(Number(selectedDoneTaskId));

      setPages((current) => {
        const exists = current.some((page) => page.id === generated.id);
        if (exists) {
          return current.map((page) => (page.id === generated.id ? generated : page));
        }

        return [generated, ...current];
      });

      setSelectedPage(generated);
      await loadPageHistory(generated.id);
      setTitle(generated.title);
      setContent(generated.content);
      setIsEditing(false);
      toast.success("Documentation generated from completed task.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not generate documentation from task."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <Card className="max-w-lg border-slate-800 bg-slate-900/80">
          <CardContent className="p-8 text-center">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-blue-300" />
            <h1 className="text-xl font-semibold text-white">No project selected</h1>
            <p className="mt-2 text-sm text-slate-400">
              Create or join a project before writing documentation.
            </p>
            <Button asChild className="mt-5 bg-blue-600 hover:bg-blue-700">
              <Link href="/onboarding">Go to onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Project wiki for {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Read project documentation, generate pages from completed tasks, or edit wiki content when needed.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={() => loadDocumentation()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNewPage}>
            <Plus className="mr-2 h-4 w-4" />
            New page
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-300" />
          <h2 className="text-lg font-semibold text-white">
            Generate from Done task
          </h2>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <select
            value={selectedDoneTaskId}
            onChange={(event) => setSelectedDoneTaskId(event.target.value)}
            className="h-11 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-blue-500"
          >
            <option value="">Select a completed task...</option>
            {doneTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.key} - {task.title}
              </option>
            ))}
          </select>

          <Button
            className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGenerateFromTask}
            disabled={saving || !selectedTask}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate documentation
          </Button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Only tasks with status Done are eligible for generated documentation.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-white">Pages</h2>
                <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                  {pages.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => handleSelectPage(page)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition",
                      selectedPage?.id === page.id
                        ? "border-blue-500/40 bg-blue-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-blue-500/30 hover:bg-slate-950"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {page.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Updated {formatDate(page.updated_at)}
                        </p>
                        {page.task_id && (
                          <Badge className="mt-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                            Task #{page.task_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {pages.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
                    <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                    <p className="text-sm text-slate-500">
                      No documentation pages yet.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-violet-300" />
                  <h2 className="font-semibold text-white">Version history</h2>
                </div>
                {loadingHistory ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                ) : (
                  <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                    {revisions.length}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {revisions.slice(0, 8).map((revision) => (
                  <div
                    key={revision.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="border-violet-500/20 bg-violet-500/10 text-violet-200">
                        {revision.action}
                      </Badge>
                      <span className="text-xs text-slate-600">
                        {formatDate(revision.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-slate-200">
                      {revision.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {revision.content.length.toLocaleString()} chars snapshot
                    </p>
                  </div>
                ))}

                {!loadingHistory && selectedPage && revisions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      No previous revisions yet.
                    </p>
                  </div>
                )}

                {!selectedPage && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      Select a page to view history.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-600">
                  {isEditing ? "Editing" : "Preview"}
                </p>
                <h2 className="truncate text-2xl font-bold text-white">{title}</h2>
                {selectedPage && (
                  <p className="mt-2 text-xs text-slate-500">
                    Updated {formatDate(selectedPage.updated_at)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {isEditing ? (
                  <>
                    {selectedPage && (
                      <Button
                        variant="outline"
                        className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}

                    <Button
                      className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="border-slate-800 bg-slate-950 text-slate-100"
                  placeholder="Page title"
                />

                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-[620px] border-slate-800 bg-slate-950 font-mono text-sm leading-6 text-slate-100"
                  placeholder="Write documentation..."
                />
              </div>
            ) : (
              <div className="min-h-[620px] rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <MarkdownPreview content={content} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
