import { Input } from "@/components/ui/input";

interface CharCountInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
}

const CharCountInput = ({ label, value, onChange, maxLength, placeholder, required }: CharCountInputProps) => (
  <div>
    <label className="field-label">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
      placeholder={placeholder}
      maxLength={maxLength}
    />
    <div className="char-counter">
      {value.length}/{maxLength}
    </div>
  </div>
);

export default CharCountInput;
