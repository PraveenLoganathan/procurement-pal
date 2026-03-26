import SectionWrapper from "./SectionWrapper";
import SupplierCard, { type SupplierData } from "./SupplierCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { v4 } from "@/lib/uid";

interface Props {
  suppliers: SupplierData[];
  onChange: (suppliers: SupplierData[]) => void;
}

const SuppliersSection = ({ suppliers, onChange }: Props) => {
  const addSupplier = () => {
    if (suppliers.length >= 5) return;
    onChange([
      ...suppliers,
      {
        id: v4(),
        companyName: "",
        currency: "KWD",
        totalExclVat: "",
        totalInclVat: "",
        totalKwd: "",
        recommended: false,
        justification: "",
        files: [],
      },
    ]);
  };

  const updateSupplier = (index: number, supplier: SupplierData) => {
    const updated = [...suppliers];
    updated[index] = supplier;
    onChange(updated);
  };

  const removeSupplier = (index: number) => {
    onChange(suppliers.filter((_, i) => i !== index));
  };

  return (
    <SectionWrapper number={2} title="Suppliers">
      <p className="text-sm text-muted-foreground -mt-1 mb-4">
        Add between 1 and 5 supplier quotations. At least one supplier is required.
      </p>

      <div className="space-y-4">
        {suppliers.map((s, i) => (
          <SupplierCard
            key={s.id}
            index={i}
            supplier={s}
            onChange={(updated) => updateSupplier(i, updated)}
            onRemove={() => removeSupplier(i)}
            canRemove={suppliers.length > 1}
          />
        ))}
      </div>

      {suppliers.length < 5 && (
        <Button variant="outline" onClick={addSupplier} className="mt-4 w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier ({suppliers.length}/5)
        </Button>
      )}
    </SectionWrapper>
  );
};

export default SuppliersSection;
