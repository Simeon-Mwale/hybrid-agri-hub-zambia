"use client";

import { useEffect, useState } from "react";

export default function ManageMarkets() {
  const [markets, setMarkets] = useState([]);
  const [name, setName] = useState("");
  const [province, setProvince] = useState("");

  useEffect(() => {
    fetch("/api/admin/markets").then((res) => res.json()).then(setMarkets);
  }, []);

  const handleAdd = async () => {
    if (!name || !province) return;
    await fetch("/api/admin/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, province }),
    });
    setName(""); setProvince("");
    const updated = await fetch("/api/admin/markets").then((res) => res.json());
    setMarkets(updated);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Manage Markets</h1>

      <div className="mb-6 flex gap-2">
        <input className="border p-2 rounded" placeholder="Market Name" value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Province" value={province} onChange={(e)=>setProvince(e.target.value)} />
        <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded">Add Market</button>
      </div>

      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Market</th>
            <th className="p-2 text-left">Province</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m:any, idx:number)=>(
            <tr key={m.id} className="border-b">
              <td className="p-2">{idx+1}</td>
              <td className="p-2">{m.name}</td>
              <td className="p-2">{m.province}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
 
