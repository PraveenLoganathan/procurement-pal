import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Upload, Star } from "lucide-react";
import React, { useRef } from "react";

const CURRENCIES = ["KWD", "USD", "EUR", "GBP", "SAR", "AED", "BHD"];

export interface SupplierData {
  id: string;
  companyName: string;
  currency: string;
  totalExclVat: string;
  totalInclVat: string;
  totalKwd: string;
  recommended: boolean;
  justification: string;
  files: File[];
}

interface Props {
  index: number;
  supplier: SupplierData;
  onChange: (supplier: SupplierData) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const RATES: Record<string, number> = {
  KWD: 1, USD: 0.31, EUR: 0.28, GBP: 0.24, SAR: 1.15, AED: 1.13, BHD: 0.12,
};

const SupplierCard = ({ index, supplier, onChange, onRemove, canRemove }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof SupplierData, value: string | boolean | File[]) => {
    const updated = { ...supplier, [field]: value };
    // Auto-convert to KWD
    if ((field === "totalInclVat" || field === "currency") && updated.totalInclVat && updated.currency) {
      const rate = RATES[updated.currency] || 1;
      const amount = parseFloat(updated.totalInclVat);
      if (!isNaN(amount)) {
        updated.totalKwd = (amount * rate).toFixed(3);
      }
    }
    onChange(updated);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      update("files", [...supplier.files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (idx: number) => {
    update("files", supplier.files.filter((_, i) => i !== idx));
  };

  return (
    <div className="supplier-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Supplier {index + 1}</span>
          {supplier.recommended && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
              <Star className="w-3 h-3" /> Recommended
            </span>
          )}
        </div>
        {canRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="field-label">
            Company Name<span className="text-destructive ml-0.5">*</span>
          </label>
          <Input
            value={supplier.companyName}
            onChange={(e) => update("companyName", e.target.value)}
            placeholder="Enter supplier company name"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Currency</label>
            <Select value={supplier.currency} onValueChange={(v) => update("currency", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label">Total excl. VAT</label>
            <Input
              type="number"
              value={supplier.totalExclVat}
              onChange={(e) => update("totalExclVat", e.target.value)}
              placeholder="0.000"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Total incl. VAT</label>
            <Input
              type="number"
              value={supplier.totalInclVat}
              onChange={(e) => update("totalInclVat", e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div>
            <label className="field-label">Total in KWD</label>
            <Input
              value={supplier.totalKwd}
              readOnly
              className="bg-muted"
              placeholder="Auto-calculated"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Checkbox
            checked={supplier.recommended}
            onCheckedChange={(checked) => update("recommended", !!checked)}
          />
          <div className="flex-1">
            <label className="text-sm font-medium cursor-pointer">
              Recommend this supplier
            </label>
            {supplier.recommended && (
              <div className="mt-2">
                <Textarea
                  value={supplier.justification}
                  onChange={(e) => update("justification", e.target.value)}
                  placeholder="Provide justification for recommending this supplier"
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="field-label">Quote / Supporting Documents</label>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="file-drop-zone w-full"
          >
            <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to upload files</span>
          </button>
          {supplier.files.length > 0 && (
            <div className="mt-2 space-y-1">
              {supplier.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted text-sm">
                  <span className="truncate">{f.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierCard;
