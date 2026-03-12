export interface IssuesTriageHandlers {
  applyFilter: (token: string) => void;
  resolveSelected: () => void;
  ignoreSelected: () => void;
  reopenSelected: () => void;
  exportSelected: () => void;
  openDiff: () => void;
  mergeSelected: () => void;
}

export interface IssuesTriageState {
  active: boolean;
  busy: boolean;
  hasSelectedIssue: boolean;
  selectedCount: number;
  canResolve: boolean;
  canIgnore: boolean;
  canReopen: boolean;
  canMerge: boolean;
  handlers: IssuesTriageHandlers;
}

let current: IssuesTriageState | null = null;
const listeners = new Set<() => void>();

export function registerIssuesTriage(state: IssuesTriageState | null): void {
  current = state;
  for (const listener of listeners) {
    listener();
  }
}

export function getIssuesTriage(): IssuesTriageState | null {
  return current;
}

export function subscribeIssuesTriage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
