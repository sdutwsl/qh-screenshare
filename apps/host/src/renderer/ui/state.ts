export interface AppState {
  isSharing: boolean;
  roomId: string | null;
  viewerCount: number;
  statusText: string;
  statusType: "connected" | "disconnected" | "error";
  errorMessage: string | null;
}

export function createInitialState(): AppState {
  return {
    isSharing: false,
    roomId: null,
    viewerCount: 0,
    statusText: "未共享",
    statusType: "disconnected",
    errorMessage: null,
  };
}

type StateListener = (state: AppState) => void;

export class StateManager {
  private state: AppState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = createInitialState();
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("State listener error:", err);
      }
    }
  }
}

export const stateManager = new StateManager();
