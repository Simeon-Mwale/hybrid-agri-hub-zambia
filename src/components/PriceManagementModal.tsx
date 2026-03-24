"use client";

import { useState, useEffect, FormEvent } from "react";

export interface Crop {
  id: string;
  name: string;
}

export interface Market {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  action: "add" | "edit";
  crops: Crop[];
  markets: Market[];
  onSave: (data: any) => Promise<any>;
}

export default function PriceManagementModal({
  isOpen,
  onClose,
  action,
  crops,
  markets,
  onSave,
}: Props) {
  const [form, setForm] = useState({
    cropId: "",
    marketId: "",
    price: "" as number | "",
    priceDate: new Date().toISOString().slice(0, 10),
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      cropId: "",
      marketId: "",
      price: "",
      priceDate: new Date().toISOString().slice(0, 10),
    });

    setErrors({});
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: any = {};

    if (!form.cropId) newErrors.cropId = "Crop is required";
    if (!form.marketId) newErrors.marketId = "Market is required";
    if (form.price === "" || Number(form.price) <= 0)
      newErrors.price = "Enter a valid price";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const crop = crops.find((c) => c.id === form.cropId);
    const market = markets.find((m) => m.id === form.marketId);

    if (!crop || !market) return;

    try {
      setLoading(true);

     await onSave({
  cropId: form.cropId,
  marketId: form.marketId,
  price: Number(form.price),
  priceDate: form.priceDate,
});

      onClose();
    } catch (err) {
      alert("Failed to save price");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">
          {action === "add" ? "Add New Price" : "Edit Price"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Crop */}
          <div>
            <label className="text-sm font-medium">Crop</label>
            <select
              value={form.cropId}
              onChange={(e) =>
                setForm((f) => ({ ...f, cropId: e.target.value }))
              }
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.cropId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select crop</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.cropId && (
              <p className="text-xs text-red-500 mt-1">{errors.cropId}</p>
            )}
          </div>

          {/* Market */}
          <div>
            <label className="text-sm font-medium">Market</label>
            <select
              value={form.marketId}
              onChange={(e) =>
                setForm((f) => ({ ...f, marketId: e.target.value }))
              }
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.marketId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select market</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {errors.marketId && (
              <p className="text-xs text-red-500 mt-1">{errors.marketId}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="text-sm font-medium">Price (ZMW)</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({
                  ...f,
                  price: value === "" ? "" : Number(value),
                }));
              }}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.price ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.price && (
              <p className="text-xs text-red-500 mt-1">{errors.price}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={form.priceDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, priceDate: e.target.value }))
              }
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
