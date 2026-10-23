"use client";

import {
  type DragEvent,
  type ChangeEvent,
  useState,
  useCallback,
  useRef,
} from "react";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  /** Called when files are selected or dropped. */
  onFiles: (files: File[]) => void;
  /** Accepted MIME types (e.g. ["image/png", "image/jpeg"]). */
  accept?: string[];
  /** Maximum file size in bytes. Defaults to 10MB. */
  maxSize?: number;
  /** Whether multiple files are allowed. Defaults to true. */
  multiple?: boolean;
  /** Label text for the drop zone. */
  label?: string;
  /** Description text (e.g. file type and size limits). */
  description?: string;
  /** Whether the zone is disabled. */
  disabled?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

interface SelectedFile {
  file: File;
  error?: string;
}

/**
 * Formats a byte count into a human readable string. Sizes of 1 TB and above
 * clamp to the largest supported unit so the label never falls back to bytes.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / Math.pow(1024, exponent);
  const formatted = value.toFixed(exponent === 0 ? 0 : 1);

  switch (exponent) {
    case 0:
      return `${formatted} B`;
    case 1:
      return `${formatted} KB`;
    case 2:
      return `${formatted} MB`;
    default:
      return `${formatted} GB`;
  }
}

/**
 * Stable identity for duplicate detection when the same file is picked or
 * dropped more than once in a session.
 */
function fileKey(file: File): string {
  return `${file.name}:${String(file.size)}:${String(file.lastModified)}`;
}

/**
 * Drag and drop file upload zone with file list, size/type validation display,
 * and remove functionality. Supports single and multi file selection.
 */
function FileUploadZone({
  onFiles,
  accept,
  maxSize = 10 * 1024 * 1024,
  multiple = true,
  label = "Drop files here or click to browse",
  description,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const spaceHeld = useRef(false);

  const validateFile = useCallback(
    (file: File): string | undefined => {
      if (accept && accept.length > 0) {
        const isAccepted = accept.some((type) => {
          if (type.endsWith("/*")) {
            return file.type.startsWith(type.replace("/*", "/"));
          }
          return file.type === type;
        });
        if (!isAccepted) {
          return `File type ${file.type || "unknown"} is not accepted`;
        }
      }
      if (file.size > maxSize) {
        return `File exceeds ${formatBytes(maxSize)} limit`;
      }
      return undefined;
    },
    [accept, maxSize],
  );

  const commitSelection = useCallback(
    (next: SelectedFile[]) => {
      setSelectedFiles(next);
      onFiles(next.filter((f) => !f.error).map((f) => f.file));
    },
    [onFiles],
  );

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      // The native picker enforces `multiple={false}`, but drag and drop does
      // not, so a single file zone must drop the extra files itself. Keep the
      // first file so the drop behaves like a single file choice.
      const limited = multiple ? incoming : incoming.slice(0, 1);
      const processed: SelectedFile[] = limited.map((file) => ({
        file,
        error: validateFile(file),
      }));

      if (!multiple) {
        commitSelection(processed);
        return;
      }

      // Re-selecting or re-dropping a file must not append a duplicate row.
      const seen = new Set(selectedFiles.map((item) => fileKey(item.file)));
      const additions = processed.filter((item) => {
        const key = fileKey(item.file);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      commitSelection([...selectedFiles, ...additions]);
    },
    [commitSelection, multiple, selectedFiles, validateFile],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      e.target.value = "";
    },
    [processFiles],
  );

  const removeFile = useCallback(
    (index: number) => {
      commitSelection(selectedFiles.filter((_, i) => i !== index));
    },
    [commitSelection, selectedFiles],
  );

  const defaultDescription =
    description ||
    `${accept ? accept.map((t) => t.split("/")[1]?.toUpperCase()).join(", ") : "Any file type"} up to ${formatBytes(maxSize)}`;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.click();
          } else if (e.key === " ") {
            // Prevent the page from scrolling while Space is held; activation
            // happens on keyup to match native button semantics.
            e.preventDefault();
            spaceHeld.current = true;
          }
        }}
        onKeyUp={(e) => {
          if (disabled) return;
          if (e.key === " " && spaceHeld.current) {
            e.preventDefault();
            spaceHeld.current = false;
            inputRef.current?.click();
          }
        }}
        onBlur={() => {
          spaceHeld.current = false;
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 motion-reduce:transition-none",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/50",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{defaultDescription}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept?.join(",")}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* File list */}
      {selectedFiles.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {selectedFiles.map((item, index) => (
            <li
              key={`${item.file.name}-${String(index)}`}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                item.error
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card",
              )}
            >
              {item.error ? (
                <AlertCircle
                  className="size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
              ) : (
                <FileText
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">
                  {item.file.name}
                </p>
                {item.error ? (
                  <p className="text-xs text-destructive">{item.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                aria-label={`Remove ${item.file.name}`}
                className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { FileUploadZone, formatBytes };
export type { FileUploadZoneProps };
