"use client";

import { useEffect, useState } from "react";

type Alert = { cropName: string; marketName: string; targetPrice: number; reached: boolean };

export default function FarmerAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch("/api/farmer/alerts").then(res => res.json()).then(setAlerts);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Price Alerts</h1>
      <ul className="space-y-2">
        {alerts.map((a, idx) => (
          <li key={idx} className={`flex justify-between p-2 shadow rounded ${a.reached ? "bg-green-100" : "bg-white"}`}>
            <span>{a.cropName} - {a.marketName} target: K{a.targetPrice}</span>
            <span>{a.reached ? "Reached!" : "Pending"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
