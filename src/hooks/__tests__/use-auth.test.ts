import { describe, test, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const signInAction = vi.fn();
const signUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => signInAction(...args),
  signUp: (...args: unknown[]) => signUpAction(...args),
}));

const getAnonWorkData = vi.fn();
const clearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => getAnonWorkData(),
  clearAnonWork: () => clearAnonWork(),
}));

const getProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => getProjects(),
}));

const createProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (input: unknown) => createProject(input),
}));

import { useAuth } from "@/hooks/use-auth";

beforeEach(() => {
  push.mockReset();
  signInAction.mockReset();
  signUpAction.mockReset();
  getAnonWorkData.mockReset();
  clearAnonWork.mockReset();
  getProjects.mockReset();
  createProject.mockReset();
});

describe("useAuth — initial state", () => {
  test("isLoading is false on first render", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  test("forwards email/password to the signIn action and returns its result", async () => {
    signInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signIn("alice@example.com", "hunter2");
    });

    expect(signInAction).toHaveBeenCalledWith("alice@example.com", "hunter2");
    expect(returned).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("does not run post-signin navigation when the action reports failure", async () => {
    signInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("alice@example.com", "wrong");
    });

    expect(getAnonWorkData).not.toHaveBeenCalled();
    expect(getProjects).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(clearAnonWork).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  test("on success with anon work, creates a project from the anon data and routes to it", async () => {
    signInAction.mockResolvedValue({ success: true });
    const anon = {
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: { "/": { type: "directory" }, "/App.jsx": { type: "file" } },
    };
    getAnonWorkData.mockReturnValue(anon);
    createProject.mockResolvedValue({ id: "proj-anon" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("alice@example.com", "hunter2");
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    const arg = createProject.mock.calls[0][0];
    expect(arg.messages).toBe(anon.messages);
    expect(arg.data).toBe(anon.fileSystemData);
    expect(arg.name).toMatch(/^Design from /);

    expect(clearAnonWork).toHaveBeenCalledTimes(1);
    expect(getProjects).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/proj-anon");
  });

  test("when anon work exists but has no messages, falls through to the projects flow", async () => {
    signInAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue({
      messages: [],
      fileSystemData: { "/": { type: "directory" } },
    });
    getProjects.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("alice@example.com", "hunter2");
    });

    expect(createProject).not.toHaveBeenCalled();
    expect(clearAnonWork).not.toHaveBeenCalled();
    expect(getProjects).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/p1");
  });

  test("when getAnonWorkData returns null, routes to the most recent project", async () => {
    signInAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockResolvedValue([
      { id: "newest" },
      { id: "older" },
      { id: "oldest" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("alice@example.com", "hunter2");
    });

    expect(push).toHaveBeenCalledWith("/newest");
    expect(push).toHaveBeenCalledTimes(1);
    expect(createProject).not.toHaveBeenCalled();
  });

  test("when the user has no projects, creates a new design and routes to it", async () => {
    signInAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockResolvedValue([]);
    createProject.mockResolvedValue({ id: "fresh" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("alice@example.com", "hunter2");
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    const arg = createProject.mock.calls[0][0];
    expect(arg.messages).toEqual([]);
    expect(arg.data).toEqual({});
    expect(arg.name).toMatch(/^New Design #\d+$/);

    expect(push).toHaveBeenCalledWith("/fresh");
  });
});

describe("useAuth — signUp", () => {
  test("forwards email/password to the signUp action and returns its result", async () => {
    signUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.signUp("new@example.com", "password123");
    });

    expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
    expect(returned).toEqual({ success: false, error: "Email already registered" });
  });

  test("does not run post-signin navigation when sign-up fails", async () => {
    signUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(getAnonWorkData).not.toHaveBeenCalled();
    expect(getProjects).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  test("on success, runs the same post-signin navigation as signIn", async () => {
    signUpAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockResolvedValue([{ id: "after-signup" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(push).toHaveBeenCalledWith("/after-signup");
  });

  test("on success with anon work, claims it into a new project", async () => {
    signUpAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "draft" }],
      fileSystemData: { "/": {}, "/App.jsx": {} },
    });
    createProject.mockResolvedValue({ id: "claimed" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(clearAnonWork).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/claimed");
  });
});

describe("useAuth — isLoading lifecycle", () => {
  test("flips to true while signIn is in flight and back to false after it settles", async () => {
    let resolveAction!: (value: { success: boolean }) => void;
    signInAction.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveAction = resolve;
        })
    );
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockResolvedValue([{ id: "x" }]);

    const { result } = renderHook(() => useAuth());

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.signIn("a@b.com", "pw");
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      resolveAction({ success: true });
      await pending;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("flips to true while signUp is in flight and back to false after it settles", async () => {
    let resolveAction!: (value: { success: boolean }) => void;
    signUpAction.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveAction = resolve;
        })
    );
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockResolvedValue([{ id: "x" }]);

    const { result } = renderHook(() => useAuth());

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.signUp("a@b.com", "password123");
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => {
      resolveAction({ success: true });
      await pending;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the signIn action rejects", async () => {
    signInAction.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useAuth());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signIn("a@b.com", "pw");
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("network down");
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when the signUp action rejects", async () => {
    signUpAction.mockRejectedValue(new Error("server fire"));
    const { result } = renderHook(() => useAuth());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signUp("a@b.com", "password123");
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("server fire");
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when post-signin work rejects", async () => {
    signInAction.mockResolvedValue({ success: true });
    getAnonWorkData.mockReturnValue(null);
    getProjects.mockRejectedValue(new Error("db unreachable"));

    const { result } = renderHook(() => useAuth());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signIn("a@b.com", "pw");
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(result.current.isLoading).toBe(false);
  });
});
