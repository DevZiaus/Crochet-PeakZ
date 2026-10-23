import { describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { FileUploadZone, formatBytes } from "./file-upload-zone";

function makeFile(
  name: string,
  content: string,
  lastModified = 1000,
  type = "image/png",
): File {
  return new File([content], name, { type, lastModified });
}

describe("formatBytes", () => {
  it("formats the common units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 ** 2)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("clamps terabyte values to GB instead of falling back to bytes", () => {
    expect(formatBytes(1024 ** 4)).toBe("1024.0 GB");
    expect(formatBytes(2 * 1024 ** 4)).toBe("2048.0 GB");
  });
});

describe("FileUploadZone", () => {
  it("prevents the page from scrolling when Space is pressed", () => {
    render(<FileUploadZone onFiles={vi.fn()} />);

    const zone = screen.getByRole("button", {
      name: "Drop files here or click to browse",
    });
    const event = createEvent.keyDown(zone, { key: " " });
    fireEvent(zone, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("does not append the same file twice", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    const file = makeFile("yarn.png", "yarn");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(onFiles).toHaveBeenLastCalledWith([file]);
  });

  it("keeps one file when a multi file drop lands on a single file zone", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} multiple={false} />);

    const zone = screen.getByRole("button", {
      name: "Drop files here or click to browse",
    });
    const first = makeFile("first.png", "first");
    const second = makeFile("second.png", "second");

    fireEvent.drop(zone, { dataTransfer: { files: [first, second] } });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(onFiles).toHaveBeenLastCalledWith([first]);
  });

  it("rejects a file whose type is not accepted", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} accept={["image/png"]} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    fireEvent.change(input, {
      target: { files: [makeFile("notes.txt", "notes", 1000, "text/plain")] },
    });

    expect(
      screen.getByText("File type text/plain is not accepted"),
    ).toBeInTheDocument();
    expect(onFiles).toHaveBeenLastCalledWith([]);
  });

  it("accepts a file that matches a wildcard type", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} accept={["image/*"]} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    const file = makeFile("photo.jpg", "photo", 1000, "image/jpeg");
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFiles).toHaveBeenLastCalledWith([file]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("rejects a file over the size limit and accepts one exactly at it", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} maxSize={2} multiple={false} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    fireEvent.change(input, {
      target: { files: [makeFile("too-big.png", "abc")] },
    });
    expect(screen.getByText("File exceeds 2 B limit")).toBeInTheDocument();
    expect(onFiles).toHaveBeenLastCalledWith([]);

    const atLimit = makeFile("at-limit.png", "ab", 1001);
    fireEvent.change(input, { target: { files: [atLimit] } });
    expect(onFiles).toHaveBeenLastCalledWith([atLimit]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("removes a file from the list and re-emits the remainder", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    const first = makeFile("yarn.png", "yarn");
    const second = makeFile("wool.png", "wool", 1001);
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(onFiles).toHaveBeenLastCalledWith([first, second]);

    fireEvent.click(screen.getByRole("button", { name: "Remove yarn.png" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(onFiles).toHaveBeenLastCalledWith([second]);
  });

  it("empties the list and emits nothing when the last file is removed", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} multiple={false} />);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    const file = makeFile("only.png", "only");
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Remove only.png" }));

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(onFiles).toHaveBeenLastCalledWith([]);
  });

  it("removes a rejected file's row without emitting it", () => {
    const onFiles = vi.fn();
    render(
      <FileUploadZone
        onFiles={onFiles}
        accept={["image/png"]}
        multiple={false}
      />,
    );

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }

    // A rejected file is listed with an inline error but never forwarded.
    fireEvent.change(input, {
      target: { files: [makeFile("notes.txt", "notes", 1000, "text/plain")] },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(onFiles).toHaveBeenLastCalledWith([]);

    fireEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(onFiles).toHaveBeenLastCalledWith([]);
  });

  it("marks a disabled zone aria-disabled", () => {
    render(<FileUploadZone onFiles={vi.fn()} disabled />);

    const zone = screen.getByRole("button", {
      name: "Drop files here or click to browse",
    });
    expect(zone).toHaveAttribute("aria-disabled", "true");
  });

  it("does not open the file picker when disabled is clicked", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      render(<FileUploadZone onFiles={vi.fn()} disabled />);

      const zone = screen.getByRole("button");
      fireEvent.click(zone);

      expect(clickSpy).not.toHaveBeenCalled();
    } finally {
      clickSpy.mockRestore();
    }
  });

  it("opens the file picker when an enabled zone is clicked", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      render(<FileUploadZone onFiles={vi.fn()} />);

      fireEvent.click(screen.getByRole("button"));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it("ignores a drop and disables the picker input when disabled", () => {
    const onFiles = vi.fn();
    render(<FileUploadZone onFiles={onFiles} disabled />);

    const zone = screen.getByRole("button");
    const file = makeFile("yarn.png", "yarn");

    // A disabled zone ignores drag and drop. The native input carries the
    // `disabled` attribute, which blocks the click that opens the picker, so a
    // real user cannot reach `change` either.
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected a file input to be rendered");
    }
    expect(input).toBeDisabled();
  });
});
