import { Textarea } from "@/components/ui/textarea";

interface CharCountTextareaProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

const CharCountTextarea = ({ label, value, onChange, maxLength, placeholder, required, rows = 4 }: CharCountTextareaProps) => (
  <div>
    <label className="field-label">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
    />
    <div className="char-counter">
      {value.length}/{maxLength}
    </div>
  </div>
);

export default CharCountTextarea;
