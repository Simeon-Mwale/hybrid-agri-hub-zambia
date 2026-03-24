"use client";

import { useState, useEffect } from "react";

export default function PriceUpload() {
  const [crops, setCrops] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [priceData, setPriceData] = useState({ cropId: "", marketId: "", price: "" });

  useEffect(() => {
    fetch("/api/admin/crops").then((res) => res.json()).then(setCrops);
    fetch("/api/admin/markets").then((res) => res.json()).then(setMarkets);
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await fetch("/api/admin/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(priceData),
    });
    alert("Price uploaded successfully!");
    setPriceData({ cropId: "", marketId: "", price: "" });
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Upload Daily Prices</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block font-semibold mb-1">Crop</label>
          <select
            className="border p-2 w-full rounded"
            value={priceData.cropId}
            onChange={(e) => setPriceData({ ...priceData, cropId: e.target.value })}
            required
          >
            <option value="">Select Crop</option>
            {crops.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Market</label>
          <select
            className="border p-2 w-full rounded"
            value={priceData.marketId}
            onChange={(e) => setPriceData({ ...priceData, marketId: e.target.value })}
            required
          >
            <option value="">Select Market</option>
            {markets.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Price (ZMW)</label>
          <input
            type="number"
            className="border p-2 w-full rounded"
            value={priceData.price}
            onChange={(e) => setPriceData({ ...priceData, price: e.target.value })}
            required
          />
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Upload Price
        </button>
      </form>
    </div>
  );
}
 
