"use client";

import type { ChangeEvent } from "react";
import { Camera, CheckCircle2, Loader2, Settings, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveMediaUrl } from "@/components/user-avatar";
import type { Project } from "@/services/project";
import { METHODOLOGY_HELP } from "./settings-constants";
import { getProjectInitials } from "./settings-utils";

// Cardul General strange identitatea proiectului si metodologia, fara sa contina apeluri API.
export function SettingsGeneralCard({
  project,
  projectName,
  description,
  methodology,
  canUpdateProject,
  canManageSettings,
  uploadingProjectLogo,
  removingProjectLogo,
  onProjectNameChange,
  onDescriptionChange,
  onMethodologyChange,
  onProjectLogoUpload,
  onProjectLogoDelete,
}: {
  project: Project;
  projectName: string;
  description: string;
  methodology: string;
  canUpdateProject: boolean;
  canManageSettings: boolean;
  uploadingProjectLogo: boolean;
  removingProjectLogo: boolean;
  onProjectNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onMethodologyChange: (value: string) => void;
  onProjectLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onProjectLogoDelete: () => void;
}) {
  const projectLogoUrl = resolveMediaUrl(project.logo_url);
  const projectInitials = getProjectInitials(projectName || project.name, project.key);

  return (
    <Card className="border-slate-800 bg-slate-900 text-slate-50">
      <CardHeader className="border-b border-slate-800">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-5 w-5 text-blue-300" />
          General
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <Label>Project name</Label>
            <Input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              disabled={!canUpdateProject}
              className="h-11 border-slate-700 bg-slate-950"
            />
          </div>

          <div className="space-y-2">
            <Label>Project key</Label>
            <Input
              value={project.key}
              disabled
              className="h-11 border-slate-800 bg-slate-950 font-mono text-slate-500"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-500/25 bg-blue-500/10 text-sm font-black text-blue-200 shadow-lg shadow-blue-950/20">
                {projectLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={projectLogoUrl}
                    alt={`${project.name} icon`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  projectInitials
                )}
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-white">Project icon</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Upload a square SVG, PNG, JPG, WEBP or GIF. Maximum size 2MB.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                id="project-logo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                disabled={!canUpdateProject || uploadingProjectLogo}
                onChange={onProjectLogoUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("project-logo-input")?.click()}
                disabled={!canUpdateProject || uploadingProjectLogo}
                className="h-10 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              >
                {uploadingProjectLogo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Upload icon
              </Button>

              {project.logo_url && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onProjectLogoDelete}
                  disabled={!canUpdateProject || removingProjectLogo}
                  className="h-10 border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                >
                  {removingProjectLogo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            disabled={!canUpdateProject}
            className="min-h-28 border-slate-700 bg-slate-950"
            placeholder="Describe what this project is about."
          />
        </div>

        {canManageSettings && (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Methodology</Label>
              <Select value={methodology} onValueChange={onMethodologyChange}>
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectItem value="SCRUM">SCRUM</SelectItem>
                  <SelectItem value="KANBAN">KANBAN</SelectItem>
                  <SelectItem value="SCRUMBAN">SCRUMBAN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <p className="font-medium text-white">{methodology}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {METHODOLOGY_HELP[methodology]}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
