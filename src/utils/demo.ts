import type { AppDataSchema, Log } from "../types";
import { getLocalDateKey } from "./calendar";
export function createDemoData(): AppDataSchema {
  const now = new Date();
  const today = getLocalDateKey(now);
  const stamp = now.toISOString();
  const later = (days: number, hours = 20) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hours, 0, 0, 0);
    return date.toISOString();
  };
  const task = (id: string, title: string, patch: Partial<Log> = {}): Log => ({
    id,
    title,
    projectId: null,
    completed: false,
    subtasks: [],
    createdAt: stamp,
    updatedAt: stamp,
    priority: "normal",
    ...patch,
  });
  return {
    version: 2,
    settings: { theme: "light", fontSize: "medium" },
    projects: [
      {
        id: "studio",
        name: "Studio refresh",
        order: 0,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "personal",
        name: "Everyday things",
        order: 1,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "ideas",
        name: "The next big thing",
        order: 2,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    logs: [
      task("design", "Review the first design direction", {
        description:
          "A fresh look, a clear story, and a little room to breathe.",
        projectId: "studio",
        priority: "high",
        myDay: today,
        deadline: later(0, 23),
        subtasks: [false, true].map((completed, i) => ({
          id: `design-sub-${i}`,
          title: i ? "Gather the references" : "Review the homepage concept",
          completed,
          createdAt: stamp,
          updatedAt: stamp,
        })),
      }),
      task("read", "Make time for a chapter", {
        projectId: "personal",
        myDay: today,
        deadline: later(0, 23),
        recurrence: { frequency: "daily", interval: 1 },
      }),
      task("direction", "Set a clear direction", {
        projectId: "ideas",
        completed: true,
        myDay: today,
      }),
      task("notes", "Turn those notes into a plan", {
        projectId: "ideas",
        priority: "high",
      }),
      task("walk", "Step outside for a little while", {
        projectId: "personal",
        priority: "low",
        deadline: later(0, 22),
      }),
      task("website", "Polish the project presentation", {
        projectId: "studio",
        deadline: later(1),
      }),
      task("weekly", "A little weekly reset", {
        projectId: "personal",
        deadline: later(2),
        recurrence: { frequency: "weekly", interval: 1 },
      }),
      task("idea", "Explore the next good idea", { projectId: "ideas" }),
    ],
    trash: [
      {
        log: task("recovered", "An idea worth a second look", {
          projectId: "ideas",
          description: "Restore this sample task to try recently deleted.",
        }),
        deletedAt: stamp,
      },
    ],
  };
}
