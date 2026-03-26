import SectionWrapper from "./SectionWrapper";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText } from "lucide-react";
import React, { useRef } from "react";

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  totalFileCount: number;
}

const MAX_FILES = 10;

const SupportingEvidenceSection = ({ files, onChange, totalFileCount }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_FILES - totalFileCount;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).slice(0, remaining);
    onChange([...files, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <SectionWrapper number={3} title="Supporting Evidence">
      <p className="text-sm text-muted-foreground -mt-1 mb-4">
        Upload supporting documents. Maximum {MAX_FILES} files across all uploads ({totalFileCount}/{MAX_FILES} used).
      </p>

      <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />

      <button
        type="button"
        onClick={() => remaining > 0 && fileRef.current?.click()}
        className={`file-drop-zone w-full ${remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={remaining <= 0}
      >
        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <span className="text-sm text-muted-foreground block">
          Click to upload files
        </span>
        <span className="text-xs text-muted-foreground block mt-1">
          All file types accepted
        </span>
      </button>

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted text-sm">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </SectionWrapper>
  );
};

export default SupportingEvidenceSection;
