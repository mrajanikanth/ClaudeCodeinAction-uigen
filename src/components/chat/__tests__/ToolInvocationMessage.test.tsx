import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationMessage } from "../ToolInvocationMessage";

afterEach(() => {
  cleanup();
});

test("renders 'Creating <path>' with spinner while a create call is in flight", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="partial-call"
      hasResult={false}
    />
  );

  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("renders 'Created <path>' with emerald dot once the create call completes", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Created /App.jsx")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("renders 'Edited <path>' for str_replace command when done", () => {
  render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "str_replace", path: "/App.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Edited /App.jsx")).toBeDefined();
});

test("renders 'Edited <path>' for insert command when done", () => {
  render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "insert", path: "/components/Button.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Edited /components/Button.jsx")).toBeDefined();
});

test("renders 'Read <path>' for view command when done", () => {
  render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "view", path: "/App.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Read /App.jsx")).toBeDefined();
});

test("renders 'Renaming <path> → <new_path>' for file_manager rename in flight", () => {
  render(
    <ToolInvocationMessage
      toolName="file_manager"
      args={{ command: "rename", path: "/a.jsx", new_path: "/b.jsx" }}
      state="call"
      hasResult={false}
    />
  );

  expect(screen.getByText("Renaming /a.jsx → /b.jsx")).toBeDefined();
});

test("renders 'Deleted <path>' for file_manager delete when done", () => {
  render(
    <ToolInvocationMessage
      toolName="file_manager"
      args={{ command: "delete", path: "/App.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Deleted /App.jsx")).toBeDefined();
});

test("falls back to 'Working...' for an unknown tool name in flight (raw tool name does not leak)", () => {
  render(
    <ToolInvocationMessage
      toolName="some_other_tool"
      args={{ command: "create", path: "/App.jsx" }}
      state="call"
      hasResult={false}
    />
  );

  expect(screen.getByText("Working...")).toBeDefined();
  expect(screen.queryByText("some_other_tool")).toBeNull();
});

test("falls back to 'Done' for unknown tool when done", () => {
  render(
    <ToolInvocationMessage
      toolName="some_other_tool"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      hasResult={true}
    />
  );

  expect(screen.getByText("Done")).toBeDefined();
});

test("falls back to 'Working...' for empty args without crashing", () => {
  render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{}}
      state="partial-call"
      hasResult={false}
    />
  );

  expect(screen.getByText("Working...")).toBeDefined();
});

test("relies on hasResult rather than raw state for the dot/spinner choice", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      state="result"
      hasResult={false}
    />
  );

  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});
