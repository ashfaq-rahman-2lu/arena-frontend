import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
afterEach((): void => {
  cleanup();
  vi.restoreAllMocks();
});
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (
    this: HTMLDialogElement,
  ): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false;
  };
}
let previewIndex = 0;
if (!URL.createObjectURL)
  URL.createObjectURL = (_blob: Blob | MediaSource): string =>
    `blob:test-${++previewIndex}`;
if (!URL.revokeObjectURL) URL.revokeObjectURL = (_url: string): void => {};
