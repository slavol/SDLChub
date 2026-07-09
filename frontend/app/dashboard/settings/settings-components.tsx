"use client";

import { Crown, KeyRound, Loader2, Lock, Save, Shield, Users, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/services/project";

// Starea de incarcare este separata ca pagina principala sa ramana concentrata pe date si actiuni.
export function SettingsLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950 text-blue-500">
      <Loader2 className="h-10 w-10 animate-spin" />
    </div>
  );
}

// Mesajul de acces blocat este folosit cand utilizatorul nu are nicio permisiune pentru Settings.
export function SettingsUnavailableState() {
  return (
    <div className="mx-auto max-w-3xl p-8 text-slate-50">
      <Card className="border-slate-800 bg-slate-900 text-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-300" />
            Settings unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">
            You do not have project settings permissions. Ask a Project Admin for access to the
            specific settings area you need.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsHero({
  project,
  isProjectOwner,
  canSaveProject,
  savingProject,
  loadingTransition,
  saveLabel,
  onSave,
}: {
  project: Project;
  isProjectOwner: boolean;
  canSaveProject: boolean;
  savingProject: boolean;
  loadingTransition: boolean;
  saveLabel: string;
  onSave: () => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
              {project.key}
            </Badge>
            <Badge className="bg-purple-500/10 text-purple-300 hover:bg-purple-500/10">
              {project.methodology}
            </Badge>
            {isProjectOwner && (
              <Badge className="bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
                <Crown className="mr-1 h-3 w-3" />
                Owner
              </Badge>
            )}
          </div>

          <h1 className="mt-4 break-words text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
            Project settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Manage project identity, methodology, permissions and destructive actions.
          </p>
        </div>

        {canSaveProject && (
          <Button
            onClick={onSave}
            disabled={savingProject || loadingTransition}
            className="h-11 w-full bg-blue-600 px-5 text-white hover:bg-blue-700 sm:w-auto"
          >
            {savingProject || loadingTransition ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        )}
      </div>
    </section>
  );
}

function SettingsStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: typeof Workflow;
  iconClassName: string;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-2xl p-3 ${iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold sm:text-xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsSummaryCards({
  methodology,
  rolesCount,
  memberCount,
  accessLabel,
}: {
  methodology: string;
  rolesCount: number;
  memberCount: number;
  accessLabel: string;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SettingsStatCard
        icon={Workflow}
        iconClassName="bg-blue-500/10 text-blue-300"
        label="Methodology"
        value={methodology}
      />
      <SettingsStatCard
        icon={Shield}
        iconClassName="bg-purple-500/10 text-purple-300"
        label="Roles"
        value={rolesCount}
      />
      <SettingsStatCard
        icon={Users}
        iconClassName="bg-emerald-500/10 text-emerald-300"
        label="Members"
        value={memberCount}
      />
      <SettingsStatCard
        icon={KeyRound}
        iconClassName="bg-amber-500/10 text-amber-300"
        label="Your access"
        value={accessLabel}
      />
    </section>
  );
}
