import { useCallback, useRef, useState } from "react";
import { Upload, X, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadFileToIPFS, ipfsToHttp } from "@/lib/ipfs";

export interface FileDropZoneProps {
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  value?: string;
  onUploaded: (result: { cid: string; uri: string; mimeType: string }) => void;
  onClear?: () => void;
  className?: string;
  compact?: boolean;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function FileDropZone({
  label = "Upload File",
  accept = "image/*,video/*,audio/*,model/*,application/pdf",
  maxSizeMB = 50,
  value,
  onUploaded,
  onClear,
  className,
  compact = false,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "done" : "idle");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    value ? ipfsToHttp(value) : null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedMime, setDetectedMime] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File exceeds ${maxSizeMB} MB limit`);
        setState("error");
        return;
      }

      setFileName(file.name);
      setDetectedMime(file.type);

      if (file.type.startsWith("image/")) {
        setPreview(URL.createObjectURL(file));
      } else {
        setPreview(null);
      }

      setState("uploading");
      try {
        const result = await uploadFileToIPFS(file);
        setState("done");
        setPreview(ipfsToHttp(result.uri));
        onUploaded({ cid: result.cid, uri: result.uri, mimeType: file.type });
      } catch (err: any) {
        setState("error");
        setError(err.message || "Upload failed");
      }
    },
    [maxSizeMB, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClear = () => {
    setState("idle");
    setPreview(null);
    setFileName(null);
    setError(null);
    setDetectedMime(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-sm font-medium leading-none">{label}</p>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => state !== "uploading" && inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          compact ? "min-h-[100px] p-3" : "min-h-[160px] p-6",
          dragging
            ? "border-primary bg-primary/5"
            : state === "error"
            ? "border-destructive/50 bg-destructive/5"
            : state === "done"
            ? "border-primary/40 bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {state === "uploading" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs">Uploading {fileName}...</span>
          </div>
        )}

        {state === "done" && preview && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={preview}
              alt="Preview"
              className={cn(
                "rounded-md object-cover",
                compact ? "max-h-[60px]" : "max-h-[100px]"
              )}
            />
            <div className="flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-3 w-3" />
              <span>{fileName || "Uploaded"}</span>
            </div>
          </div>
        )}

        {state === "done" && !preview && (
          <div className="flex flex-col items-center gap-2">
            <FileImage className="h-8 w-8 text-primary" />
            <div className="flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-3 w-3" />
              <span>{fileName || "Uploaded"}</span>
            </div>
            {detectedMime && (
              <span className="text-[10px] text-muted-foreground">
                {detectedMime}
              </span>
            )}
          </div>
        )}

        {(state === "idle" || state === "error") && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload
              className={cn(
                compact ? "h-5 w-5" : "h-8 w-8",
                dragging && "text-primary"
              )}
            />
            <span className="text-xs text-center">
              {compact
                ? "Drop or click"
                : "Drag & drop your file here, or click to browse"}
            </span>
            {error && (
              <span className="text-xs text-destructive">{error}</span>
            )}
          </div>
        )}

        {state === "done" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
