 "use client";

import { useEffect, useState } from "react";

export default function ManageCrops() {
  const [crops, setCrops] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/admin/crops").then((res) => res.json()).then(setCrops);
  }, []);

  const handleAdd = async () => {
    if (!name) return;
    await fetch("/api/admin/crops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    const updated = await fetch("/api/admin/crops").then((res) => res.json());
    setCrops(updated);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Manage Crops</h1>

      <div className="mb-6">
        <input
          className="border p-2 rounded mr-2"
          placeholder="New Crop Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Crop
        </button>
      </div>

      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Crop Name</th>
          </tr>
        </thead>
        <tbody>
          {crops.map((c: any, idx: number) => (
            <tr key={c.id} className="border-b">
              <td className="p-2">{idx + 1}</td>
              <td className="p-2">{c.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

